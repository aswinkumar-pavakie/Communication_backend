import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType } from '#prisma-client';
import { AssessmentContext } from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';
import { AssessmentsService } from '../assessments/assessments.service.js';
import { COMPLETION_TRANSACTION_OPTIONS } from '../common/constants/prisma-transaction.constants.js';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { StreaksService } from '../streaks/streaks.service.js';

const ACTIVITY_TYPE_TO_ASSESSMENT_CONTEXT: Record<
  ActivityType,
  AssessmentContext
> = {
  SPEAKING: AssessmentContext.GENERAL_SPEAKING,
  INTERVIEW: AssessmentContext.INTERVIEW,
  ROLEPLAY: AssessmentContext.ROLEPLAY,
  DEBATE: AssessmentContext.DEBATE,
  WRITING: AssessmentContext.WRITING,
  VOCABULARY: AssessmentContext.GENERAL_SPEAKING,
  GRAMMAR: AssessmentContext.GENERAL_SPEAKING,
  LISTENING: AssessmentContext.GENERAL_SPEAKING,
  PRONUNCIATION: AssessmentContext.GENERAL_SPEAKING,
  NETWORKING: AssessmentContext.GENERAL_SPEAKING,
};

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentService: AssessmentService,
    private readonly assessmentsService: AssessmentsService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
    private readonly streaksService: StreaksService,
  ) {}

  async createTextAttempt(
    studentId: string,
    activityId: string,
    responseText: string,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { skill: true },
    });
    if (!activity || !activity.isActive) {
      throw new NotFoundException('Activity not found.');
    }

    const attempt = await this.prisma.activityAttempt.create({
      data: { studentId, activityId, responseText, status: 'STARTED' },
    });

    return this.completeAttempt(attempt.id, activity, responseText);
  }

  /** Used by the voice pipeline once a recording has been transcribed. */
  async createVoiceAttempt(
    studentId: string,
    activityId: string,
    transcript: string,
    /** Null when the recording couldn't be stored - scoring still proceeds. */
    audioPath: string | null,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { skill: true },
    });
    if (!activity || !activity.isActive) {
      throw new NotFoundException('Activity not found.');
    }

    const attempt = await this.prisma.activityAttempt.create({
      data: {
        studentId,
        activityId,
        responseText: transcript,
        audioUrl: audioPath,
        status: 'STARTED',
      },
    });

    return this.completeAttempt(attempt.id, activity, transcript);
  }

  private async completeAttempt(
    attemptId: string,
    activity: {
      type: ActivityType;
      title: string;
      instructions: string | null;
      skill: { code: string };
    },
    content: string,
  ) {
    const assessment = await this.assessmentService.assess({
      context: ACTIVITY_TYPE_TO_ASSESSMENT_CONTEXT[activity.type],
      content,
      activityTitle: activity.title,
      activityInstructions: activity.instructions ?? undefined,
      skillCodes: [activity.skill.code],
    });

    return this.prisma.$transaction(async (tx) => {
      const completedAttempt = await tx.activityAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          overallScore: assessment.overallScore,
        },
      });

      const persistedAssessment =
        await this.assessmentsService.createForAttempt(
          attemptId,
          assessment,
          tx,
        );

      const studentId = completedAttempt.studentId;
      await this.progressService.applyAssessment(
        studentId,
        assessment.skillScores,
        tx,
      );
      await this.recommendationsService.refreshForStudent(studentId, tx);
      await this.streaksService.recordCompletion(studentId, tx);

      return { attempt: completedAttempt, assessment: persistedAssessment };
    }, COMPLETION_TRANSACTION_OPTIONS);
  }

  async findAllForActivity(
    studentId: string,
    activityId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    const where = { studentId, activityId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityAttempt.findMany({
        where,
        include: { assessment: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityAttempt.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
