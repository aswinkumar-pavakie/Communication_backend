import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActivityType } from '#prisma-client';
import {
  AssessmentContext,
  CommunicationAssessmentResult,
} from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';
import { PronunciationAssessmentResult } from '../ai/assessment/pronunciation.interface.js';
import { PronunciationService } from '../ai/assessment/pronunciation.service.js';
import { TranscriptionResult } from '../ai/stt/stt.interface.js';
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

/** For read-aloud drills: the quoted passage in the instructions is what the student must say. */
export function readAloudText(activity: {
  type: ActivityType;
  instructions: string | null;
}): string | undefined {
  if (activity.type !== 'PRONUNCIATION' || !activity.instructions)
    return undefined;
  // Straight or curly double quotes around a passage of at least 8 characters.
  const quoted = /["“]([^"”]{8,})["”]/.exec(activity.instructions);
  return quoted?.[1].trim();
}

/**
 * The LLM only sees the transcript, so it can't judge pronunciation. When the recording was
 * scored from its audio, that measured score replaces any text-based PRONUNCIATION guess and,
 * for pronunciation drills, drives most of the overall score.
 */
export function withPronunciation(
  result: CommunicationAssessmentResult,
  pronunciation: PronunciationAssessmentResult,
  activityType: ActivityType,
): CommunicationAssessmentResult {
  return {
    ...result,
    overallScore:
      activityType === 'PRONUNCIATION'
        ? Math.round(pronunciation.score * 0.7 + result.overallScore * 0.3)
        : result.overallScore,
    skillScores: [
      ...result.skillScores.filter((s) => s.skillCode !== 'PRONUNCIATION'),
      { skillCode: 'PRONUNCIATION', score: pronunciation.score },
    ],
    strengths: [...result.strengths, ...pronunciation.strengths.slice(0, 1)],
    weaknesses: [
      ...result.weaknesses,
      ...pronunciation.improvements.slice(0, 1),
    ],
  };
}

/** Fewer words than this is silence, a mis-tap or background noise - nothing fair to score. */
const MIN_SPOKEN_WORDS = 3;

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentService: AssessmentService,
    private readonly assessmentsService: AssessmentsService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
    private readonly streaksService: StreaksService,
    private readonly pronunciationService: PronunciationService,
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
    if (activity.type === 'PRONUNCIATION') {
      throw new BadRequestException(
        'Pronunciation activities are scored from your voice - record your answer instead of typing it.',
      );
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
    transcription: TranscriptionResult,
    /** Null when the recording couldn't be stored - scoring still proceeds. */
    audioPath: string | null,
  ) {
    const transcript = transcription.transcript;
    const activity = await this.getActiveActivityOrThrow(activityId);
    if (
      transcript.trim().split(/\s+/).filter(Boolean).length < MIN_SPOKEN_WORDS
    ) {
      throw new UnprocessableEntityException(
        "We couldn't hear enough speech in that recording. Hold the phone closer and try again.",
      );
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

    const pronunciation = this.pronunciationService.assess({
      transcription,
      referenceText: readAloudText(activity),
    });

    return this.completeAttempt(
      attempt.id,
      activity,
      transcript,
      pronunciation,
    );
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
    /** Audio-derived pronunciation score - only for recorded answers. */
    pronunciation: PronunciationAssessmentResult | null = null,
  ) {
    try {
      return await this.scoreAndComplete(
        attemptId,
        activity,
        content,
        pronunciation,
      );
    } catch (err) {
      // Don't leave a half-finished attempt looking "in progress" forever - mark it abandoned
      // so history hides it, then surface the original error to the student.
      await this.prisma.activityAttempt
        .updateMany({
          where: { id: attemptId, status: 'STARTED' },
          data: { status: 'ABANDONED' },
        })
        .catch((markErr) =>
          this.logger.warn(
            `Could not mark attempt abandoned: ${String(markErr)}`,
          ),
        );
      throw err;
    }
  }

  private async scoreAndComplete(
    attemptId: string,
    activity: {
      type: ActivityType;
      title: string;
      instructions: string | null;
      skill: { code: string };
    },
    content: string,
    pronunciation: PronunciationAssessmentResult | null,
  ) {
    const textAssessment = await this.assessmentService.assess({
      context: ACTIVITY_TYPE_TO_ASSESSMENT_CONTEXT[activity.type],
      content,
      activityTitle: activity.title,
      activityInstructions: activity.instructions ?? undefined,
      skillCodes: [activity.skill.code],
    });
    const assessment = pronunciation
      ? withPronunciation(textAssessment, pronunciation, activity.type)
      : textAssessment;

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

      return {
        attempt: completedAttempt,
        assessment: persistedAssessment,
        pronunciation,
      };
    }, COMPLETION_TRANSACTION_OPTIONS);
  }

  /** Validates the activity before any paid work (upload, STT) happens for a recording. */
  async getActiveActivityOrThrow(activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { skill: true },
    });
    if (!activity || !activity.isActive) {
      throw new NotFoundException('Activity not found.');
    }
    return activity;
  }

  async findAllForActivity(
    studentId: string,
    activityId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    // Abandoned = scoring failed mid-way; they have no feedback to show.
    const where = {
      studentId,
      activityId,
      status: { not: 'ABANDONED' as const },
    };
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
