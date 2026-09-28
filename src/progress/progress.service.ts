import { Injectable } from '@nestjs/common';
import { Prisma, ProgressTrend, SkillCode } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SkillScoreInput {
  skillCode: string;
  score: number;
}

const RECENT_ASSESSMENTS_LIMIT = 10;
const WEEKLY_ACTIVITY_DAYS = 7;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts Progress for each scored skill. Accepts an optional transaction client so
   * callers (AttemptsService) can apply this atomically alongside the attempt/assessment write.
   */
  async applyAssessment(
    studentId: string,
    skillScores: SkillScoreInput[],
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const skills = await tx.skill.findMany({
      where: { code: { in: skillScores.map((s) => s.skillCode as SkillCode) } },
    });
    const skillByCode = new Map(skills.map((s) => [s.code as string, s]));

    for (const scoreInput of skillScores) {
      const skill = skillByCode.get(scoreInput.skillCode);
      if (!skill) continue;

      const existing = await tx.progress.findUnique({
        where: { studentId_skillId: { studentId, skillId: skill.id } },
      });

      const previousScore = existing?.currentScore ?? null;
      const trend: ProgressTrend =
        previousScore === null
          ? 'STABLE'
          : scoreInput.score > previousScore
            ? 'IMPROVING'
            : scoreInput.score < previousScore
              ? 'DECLINING'
              : 'STABLE';

      await tx.progress.upsert({
        where: { studentId_skillId: { studentId, skillId: skill.id } },
        create: {
          studentId,
          skillId: skill.id,
          currentScore: scoreInput.score,
          previousScore: null,
          trend,
        },
        update: {
          previousScore,
          currentScore: scoreInput.score,
          trend,
          lastAssessedAt: new Date(),
        },
      });
    }
  }

  async getOverview(studentId: string) {
    const progress = await this.prisma.progress.findMany({
      where: { studentId },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });

    const overallScore = progress.length
      ? Math.round(
          progress.reduce((sum, p) => sum + p.currentScore, 0) /
            progress.length,
        )
      : 0;

    return {
      overallScore,
      skills: progress.map((p) => ({
        skillCode: p.skill.code,
        skillName: p.skill.name,
        currentScore: p.currentScore,
        previousScore: p.previousScore,
        trend: p.trend,
        lastAssessedAt: p.lastAssessedAt,
      })),
    };
  }

  async getSkills(studentId: string) {
    return this.getOverview(studentId).then((o) => o.skills);
  }

  async getHistory(studentId: string) {
    const scores = await this.prisma.assessmentScore.findMany({
      where: { assessment: { attempt: { studentId } } },
      include: { skill: true, assessment: { select: { createdAt: true } } },
      orderBy: { assessment: { createdAt: 'asc' } },
    });

    const bySkill = new Map<
      string,
      {
        skillCode: string;
        skillName: string;
        points: { date: Date; score: number }[];
      }
    >();
    for (const score of scores) {
      const key = score.skill.code;
      if (!bySkill.has(key)) {
        bySkill.set(key, {
          skillCode: key,
          skillName: score.skill.name,
          points: [],
        });
      }
      bySkill
        .get(key)!
        .points.push({ date: score.assessment.createdAt, score: score.score });
    }

    const recentAssessments = await this.prisma.assessment.findMany({
      where: { attempt: { studentId } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ASSESSMENTS_LIMIT,
      select: { id: true, overallScore: true, feedback: true, createdAt: true },
    });

    const since = new Date();
    since.setDate(since.getDate() - WEEKLY_ACTIVITY_DAYS);
    const weeklyAttempts = await this.prisma.activityAttempt.findMany({
      where: { studentId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const weeklyActivity = this.groupByDay(
      weeklyAttempts.map((a) => a.createdAt),
    );

    return {
      skillHistory: Array.from(bySkill.values()),
      recentAssessments,
      weeklyActivity,
    };
  }

  private groupByDay(dates: Date[]): { date: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const date of dates) {
      const key = date.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
