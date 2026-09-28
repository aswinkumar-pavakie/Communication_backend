import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interview, Prisma } from '#prisma-client';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { InterviewAssessmentService } from './interview-assessment.service.js';
import { InterviewQuestionService } from './interview-question.service.js';
import { InterviewQueryDto } from './dto/interview-query.dto.js';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionService: InterviewQuestionService,
    private readonly assessmentService: InterviewAssessmentService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async findAll(query: InterviewQueryDto): Promise<PaginatedResult<Interview>> {
    const where: Prisma.InterviewWhereInput = {
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.interview.count({ where }),
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

  async findOne(id: string) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) {
      throw new NotFoundException('Interview not found.');
    }
    const totalQuestions = await this.questionService.countQuestions(id);
    return { ...interview, totalQuestions };
  }

  async start(studentId: string, interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });
    if (!interview || !interview.isActive) {
      throw new NotFoundException('Interview not found.');
    }

    const firstQuestion =
      await this.questionService.getFirstQuestion(interviewId);
    if (!firstQuestion) {
      throw new BadRequestException(
        'This interview has no questions configured yet.',
      );
    }

    const attempt = await this.prisma.interviewAttempt.create({
      data: { studentId, interviewId, status: 'STARTED' },
    });

    return { attemptId: attempt.id, question: firstQuestion };
  }

  async submitAnswer(
    studentId: string,
    attemptId: string,
    questionId: string,
    answerText: string,
  ) {
    const attempt = await this.prisma.interviewAttempt.findFirst({
      where: { id: attemptId, studentId },
      include: { interview: true },
    });
    if (!attempt) {
      throw new NotFoundException('Interview attempt not found.');
    }
    if (attempt.status !== 'STARTED') {
      throw new BadRequestException(
        'This interview attempt is no longer in progress.',
      );
    }

    const question = await this.questionService.getByIdOrThrow(questionId);

    const result = await this.assessmentService.assessAnswer(
      attempt.interview,
      question,
      answerText,
    );

    const answer = await this.prisma.interviewAnswer.create({
      data: {
        interviewAttemptId: attempt.id,
        interviewQuestionId: question.id,
        answerText,
        score: result.overallScore,
        feedback: result as unknown as Prisma.InputJsonValue,
      },
    });

    const nextQuestion = await this.questionService.getNextQuestion(
      attempt.interviewId,
      question.order,
    );

    return { answer, nextQuestion };
  }

  async complete(studentId: string, attemptId: string) {
    const attempt = await this.prisma.interviewAttempt.findFirst({
      where: { id: attemptId, studentId },
      include: { answers: true },
    });
    if (!attempt) {
      throw new NotFoundException('Interview attempt not found.');
    }
    if (attempt.status === 'COMPLETED') {
      return attempt;
    }

    const scoredAnswers = attempt.answers.filter((a) => a.score !== null);
    const overallScore = scoredAnswers.length
      ? Math.round(
          scoredAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0) /
            scoredAnswers.length,
        )
      : 0;

    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.interviewAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          overallScore,
          feedback: {
            answeredQuestions: attempt.answers.length,
            averageScore: overallScore,
          },
        },
      });

      await this.progressService.applyAssessment(
        studentId,
        [{ skillCode: 'INTERVIEW', score: overallScore }],
        tx,
      );
      await this.recommendationsService.refreshForStudent(studentId, tx);

      return completed;
    });
  }

  async getResult(studentId: string, interviewId: string, attemptId?: string) {
    const attempt = await this.prisma.interviewAttempt.findFirst({
      where: {
        studentId,
        interviewId,
        ...(attemptId ? { id: attemptId } : { status: 'COMPLETED' }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        answers: { include: { question: true }, orderBy: { createdAt: 'asc' } },
        interview: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException(
        'No completed attempt found for this interview.',
      );
    }

    return attempt;
  }
}
