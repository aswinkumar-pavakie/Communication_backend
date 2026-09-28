import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '../common/types/api-response.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';

const REPORT_PERIOD_DAYS = 30;
const REPORT_FRESHNESS_HOURS = 24;
const STRONG_SKILL_THRESHOLD = 75;
const WEAK_SKILL_THRESHOLD = 60;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /** Ensures the student has an up-to-date report (regenerating if the latest is stale), then lists reports. */
  async findAll(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<unknown>> {
    await this.ensureFreshReport(studentId);

    const where = { studentId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(studentId: string, id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, studentId },
    });
    if (!report) {
      throw new NotFoundException('Report not found.');
    }
    return report;
  }

  private async ensureFreshReport(studentId: string): Promise<void> {
    const latest = await this.prisma.report.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    const isStale =
      !latest ||
      Date.now() - latest.createdAt.getTime() >
        REPORT_FRESHNESS_HOURS * 60 * 60 * 1000;

    if (isStale) {
      await this.generate(studentId);
    }
  }

  private async generate(studentId: string) {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - REPORT_PERIOD_DAYS);

    const { overallScore, skills } =
      await this.progressService.getOverview(studentId);
    const recommendations = await this.recommendationsService.findForStudent(
      studentId,
      10,
    );

    const strengths = skills
      .filter((s) => s.currentScore >= STRONG_SKILL_THRESHOLD)
      .map((s) => s.skillName);
    const weaknesses = skills
      .filter((s) => s.currentScore < WEAK_SKILL_THRESHOLD)
      .map((s) => s.skillName);

    const improvement = Object.fromEntries(
      skills.map((s) => [
        s.skillCode,
        s.previousScore === null ? 0 : s.currentScore - s.previousScore,
      ]),
    );

    const interviewSkill = skills.find((s) => s.skillCode === 'INTERVIEW');
    const readinessScore = interviewSkill
      ? Math.round((interviewSkill.currentScore + overallScore) / 2)
      : overallScore;
    const readinessLabel =
      readinessScore >= 75
        ? 'READY'
        : readinessScore >= 50
          ? 'DEVELOPING'
          : 'NEEDS_PRACTICE';

    return this.prisma.report.create({
      data: {
        studentId,
        periodStart,
        periodEnd,
        overallScore,
        skillBreakdown: skills,
        strengths,
        weaknesses,
        improvement: improvement,
        interviewReadiness: { score: readinessScore, label: readinessLabel },
        recommendedActions: recommendations.map((r) => r.reason),
      },
    });
  }
}
