import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Debate, DebatePosition, Prisma } from '#prisma-client';
import { AssessmentContext } from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';
import { LlmMessage, LlmMessageRole } from '../ai/llm/llm.interface.js';
import { LanguageModelService } from '../ai/llm/llm.service.js';
import { COMPLETION_TRANSACTION_OPTIONS } from '../common/constants/prisma-transaction.constants.js';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { StreaksService } from '../streaks/streaks.service.js';
import { DebateQueryDto } from './dto/debate-query.dto.js';
import { buildDebateSystemPrompt } from './prompts/debate-system.prompt.js';

const DEBATE_SKILL_CODES = [
  'CRITICAL_THINKING',
  'CLARITY',
  'PROFESSIONAL_TONE',
  'VOCABULARY',
];

@Injectable()
export class DebatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LanguageModelService,
    private readonly assessmentService: AssessmentService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
    private readonly streaksService: StreaksService,
  ) {}

  async findAll(query: DebateQueryDto): Promise<PaginatedResult<Debate>> {
    const where: Prisma.DebateWhereInput = {
      isActive: true,
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.debate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.debate.count({ where }),
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

  async findOne(id: string): Promise<Debate> {
    const debate = await this.prisma.debate.findUnique({ where: { id } });
    if (!debate) {
      throw new NotFoundException('Debate topic not found.');
    }
    return debate;
  }

  async startSession(
    studentId: string,
    debateId: string,
    position: DebatePosition,
  ) {
    const debate = await this.findOne(debateId);

    const session = await this.prisma.debateSession.create({
      data: {
        studentId,
        debateId,
        studentPosition: position,
        status: 'STARTED',
      },
    });

    const systemPrompt = buildDebateSystemPrompt(
      debate.topic,
      position,
      debate.description,
    );
    const opening = await this.llmService.generate({
      systemPrompt,
      messages: [
        { role: 'user', content: 'Open the debate with your first argument.' },
      ],
      temperature: 0.8,
    });

    const openingMessage = await this.prisma.debateMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: opening.content,
      },
    });

    return { session, message: openingMessage };
  }

  async sendArgument(studentId: string, sessionId: string, message: string) {
    const session = await this.getActiveSessionOrThrow(studentId, sessionId);
    const debate = await this.findOne(session.debateId);

    await this.prisma.debateMessage.create({
      data: { sessionId: session.id, role: 'USER', content: message },
    });

    const history = await this.prisma.debateMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    const systemPrompt = buildDebateSystemPrompt(
      debate.topic,
      session.studentPosition,
      debate.description,
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

    return this.prisma.debateMessage.create({
      data: {
        sessionId: session.id,
        role: 'ASSISTANT',
        content: result.content,
      },
    });
  }

  async completeSession(studentId: string, sessionId: string) {
    const session = await this.getActiveSessionOrThrow(studentId, sessionId);
    const debate = await this.findOne(session.debateId);

    const studentMessages = await this.prisma.debateMessage.findMany({
      where: { sessionId: session.id, role: 'USER' },
      orderBy: { createdAt: 'asc' },
    });

    if (studentMessages.length === 0) {
      throw new BadRequestException(
        'Cannot complete a debate session with no student arguments.',
      );
    }

    const transcript = studentMessages.map((m) => m.content).join('\n');

    const result = await this.assessmentService.assess({
      context: AssessmentContext.DEBATE,
      content: transcript,
      activityTitle: debate.topic,
      activityInstructions: debate.description ?? undefined,
      skillCodes: DEBATE_SKILL_CODES,
    });

    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.debateSession.update({
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

  /** The student's past (and in-progress) sessions for one topic, newest first, with full chats. */
  async listSessions(
    studentId: string,
    debateId: string,
    page: number,
    limit: number,
  ) {
    const where = { studentId, debateId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.debateSession.findMany({
        where,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.debateSession.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSession(studentId: string, sessionId: string) {
    const session = await this.prisma.debateSession.findFirst({
      where: { id: sessionId, studentId },
      include: { messages: { orderBy: { createdAt: 'asc' } }, debate: true },
    });
    if (!session) {
      throw new NotFoundException('Debate session not found.');
    }
    return session;
  }

  private async getActiveSessionOrThrow(studentId: string, sessionId: string) {
    const session = await this.prisma.debateSession.findFirst({
      where: { id: sessionId, studentId },
    });
    if (!session) {
      throw new NotFoundException('Debate session not found.');
    }
    if (session.status !== 'STARTED') {
      throw new BadRequestException(
        'This debate session is no longer in progress.',
      );
    }
    return session;
  }
}
