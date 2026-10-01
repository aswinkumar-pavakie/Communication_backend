import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Roleplay } from '#prisma-client';
import { AssessmentContext } from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';
import { LlmMessage, LlmMessageRole } from '../ai/llm/llm.interface.js';
import { LanguageModelService } from '../ai/llm/llm.service.js';
import {
  boundedTranscript,
  LLM_HISTORY_WINDOW,
  MAX_STUDENT_TURNS_PER_SESSION,
} from '../common/constants/chat-session.constants.js';
import { COMPLETION_TRANSACTION_OPTIONS } from '../common/constants/prisma-transaction.constants.js';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { RoleplayQueryDto } from './dto/roleplay-query.dto.js';
import { buildRoleplaySystemPrompt } from './prompts/roleplay-system.prompt.js';

const ROLEPLAY_SKILL_CODES = [
  'PROFESSIONAL_TONE',
  'CLARITY',
  'CONFIDENCE',
  'CRITICAL_THINKING',
];

@Injectable()
export class RoleplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LanguageModelService,
    private readonly assessmentService: AssessmentService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
    private readonly streaksService: StreaksService,
  ) {}

  async findAll(query: RoleplayQueryDto): Promise<PaginatedResult<Roleplay>> {
    const where: Prisma.RoleplayWhereInput = {
      isActive: true,
      ...(query.scenario ? { scenario: query.scenario } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.roleplay.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.roleplay.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<Roleplay> {
    const roleplay = await this.prisma.roleplay.findUnique({ where: { id } });
    if (!roleplay) {
      throw new NotFoundException('Roleplay scenario not found.');
    }
    return roleplay;
  }

  async startSession(studentId: string, roleplayId: string) {
    const roleplay = await this.findOne(roleplayId);

    const session = await this.prisma.roleplaySession.create({
      data: { studentId, roleplayId, status: 'STARTED' },
    });

    const systemPrompt = buildRoleplaySystemPrompt(
      roleplay.scenario,
      roleplay.title,
      roleplay.description,
    );
    const opening = await this.llmService.generate({
      systemPrompt,
      messages: [
        { role: 'user', content: 'Begin the scenario with your opening line.' },
      ],
      temperature: 0.8,
    });

    const openingMessage = await this.prisma.roleplayMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: opening.content,
      },
    });

    return { session, message: openingMessage };
  }

  async sendMessage(studentId: string, sessionId: string, message: string) {
    const session = await this.getActiveSessionOrThrow(studentId, sessionId);
    const roleplay = await this.findOne(session.roleplayId);

    const studentTurns = await this.prisma.roleplayMessage.count({
      where: { sessionId: session.id, role: 'USER' },
    });
    if (studentTurns >= MAX_STUDENT_TURNS_PER_SESSION) {
      throw new BadRequestException(
        `You've reached ${MAX_STUDENT_TURNS_PER_SESSION} replies in this roleplay - tap Finish to get your feedback.`,
      );
    }

    // Newest window only (fetched newest-first, then put back in order), plus the new reply.
    const recent = await this.prisma.roleplayMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: LLM_HISTORY_WINDOW - 1,
    });
    const history = [
      ...recent.reverse(),
      { role: 'USER' as const, content: message },
    ];

    const systemPrompt = buildRoleplaySystemPrompt(
      roleplay.scenario,
      roleplay.title,
      roleplay.description,
    );
    const llmMessages: LlmMessage[] = history.map((h) => ({
      role: h.role.toLowerCase() as LlmMessageRole,
      content: h.content,
    }));

    const result = await this.llmService.generate({
      systemPrompt,
      messages: llmMessages,
      temperature: 0.8,
    });

    // Saved together only once the reply exists, so a failed LLM call never leaves an
    // unanswered student message behind in the history.
    const [, reply] = await this.prisma.$transaction([
      this.prisma.roleplayMessage.create({
        data: { sessionId: session.id, role: 'USER', content: message },
      }),
      this.prisma.roleplayMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: result.content,
        },
      }),
    ]);
    return reply;
  }

  async completeSession(studentId: string, sessionId: string) {
    const session = await this.getActiveSessionOrThrow(studentId, sessionId);
    const roleplay = await this.findOne(session.roleplayId);

    const studentMessages = await this.prisma.roleplayMessage.findMany({
      where: { sessionId: session.id, role: 'USER' },
      orderBy: { createdAt: 'asc' },
    });

    if (studentMessages.length === 0) {
      throw new BadRequestException(
        'Cannot complete a roleplay session with no student responses.',
      );
    }

    const transcript = boundedTranscript(studentMessages.map((m) => m.content));

    const result = await this.assessmentService.assess({
      context: AssessmentContext.ROLEPLAY,
      content: transcript,
      activityTitle: roleplay.title,
      activityInstructions: roleplay.description ?? undefined,
      skillCodes: ROLEPLAY_SKILL_CODES,
    });

    return this.prisma.$transaction(async (tx) => {
      // Status-guarded claim: two concurrent /complete calls can't both apply progress.
      const claimed = await tx.roleplaySession.updateMany({
        where: { id: session.id, status: 'STARTED' },
        data: { status: 'COMPLETED' },
      });
      if (claimed.count === 0) {
        return tx.roleplaySession.findUniqueOrThrow({
          where: { id: session.id },
        });
      }
      const completed = await tx.roleplaySession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          overallScore: result.overallScore,
          feedback: result as unknown as Prisma.InputJsonValue,
        },
      });

      await this.progressService.applyAssessment(
        studentId,
        result.skillScores,
        tx,
      );
      await this.recommendationsService.refreshForStudent(studentId, tx);
      await this.streaksService.recordCompletion(studentId, tx);

      return completed;
    }, COMPLETION_TRANSACTION_OPTIONS);
  }

  /** The student's past (and in-progress) sessions for one scenario, newest first, with full chats. */
  async listSessions(
    studentId: string,
    roleplayId: string,
    page: number,
    limit: number,
  ) {
    const where = { studentId, roleplayId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.roleplaySession.findMany({
        where,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.roleplaySession.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSession(studentId: string, sessionId: string) {
    const session = await this.prisma.roleplaySession.findFirst({
      where: { id: sessionId, studentId },
      include: { messages: { orderBy: { createdAt: 'asc' } }, roleplay: true },
    });
    if (!session) {
      throw new NotFoundException('Roleplay session not found.');
    }
    return session;
  }

  private async getActiveSessionOrThrow(studentId: string, sessionId: string) {
    const session = await this.prisma.roleplaySession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!session) {
      throw new NotFoundException('Roleplay session not found.');
    }
    if (session.status !== 'STARTED') {
      throw new BadRequestException(
        'This roleplay session is no longer in progress.',
      );
    }
    return session;
  }
}
