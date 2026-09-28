import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WritingActivity } from '#prisma-client';
import { AssessmentContext } from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { WritingQueryDto } from './dto/writing-query.dto.js';

const WRITING_SKILL_CODES = [
  'GRAMMAR',
  'CLARITY',
  'PROFESSIONAL_TONE',
  'VOCABULARY',
];

@Injectable()
export class WritingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentService: AssessmentService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async findAll(
    query: WritingQueryDto,
  ): Promise<PaginatedResult<WritingActivity>> {
    const where: Prisma.WritingActivityWhereInput = {
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.writingActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.writingActivity.count({ where }),
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

  async findOne(id: string): Promise<WritingActivity> {
    const activity = await this.prisma.writingActivity.findUnique({
      where: { id },
    });
    if (!activity) {
      throw new NotFoundException('Writing activity not found.');
    }
    return activity;
  }

  async submit(studentId: string, writingActivityId: string, content: string) {
    const activity = await this.findOne(writingActivityId);

    const result = await this.assessmentService.assess({
      context: AssessmentContext.WRITING,
      content,
      activityTitle: activity.title,
      activityInstructions: activity.prompt,
      skillCodes: WRITING_SKILL_CODES,
    });

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.writingSubmission.create({
        data: {
          studentId,
          writingActivityId,
          content,
          status: 'COMPLETED',
          overallScore: result.overallScore,
          feedback: {
            feedback: result.feedback,
            strengths: result.strengths,
            weaknesses: result.weaknesses,
            suggestedResponse: result.suggestedResponse,
          },
          scores: result.skillScores as unknown as Prisma.InputJsonValue,
        },
      });

      await this.progressService.applyAssessment(
        studentId,
        result.skillScores,
        tx,
      );
      await this.recommendationsService.refreshForStudent(studentId, tx);

      return submission;
    });
  }

  findSubmissions(
    studentId: string,
    writingActivityId: string,
    page: number,
    limit: number,
  ) {
    const where = { studentId, writingActivityId };
    return this.prisma
      .$transaction([
        this.prisma.writingSubmission.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.writingSubmission.count({ where }),
      ])
      .then(([items, total]) => ({
        items,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
  }
}
