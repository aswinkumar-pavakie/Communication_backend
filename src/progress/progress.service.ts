import { Injectable } from '@nestjs/common';
import { Prisma, ProgressTrend, SkillCode } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';
import { appDayKey } from '../common/utils/app-day.js';

export interface SkillScoreInput {
  skillCode: string;
  score: number;
}

const RECENT_ASSESSMENTS_LIMIT = 10;
const WEEKLY_ACTIVITY_DAYS = 7;

interface ParsedSkillScore {
  skillCode: string;
  score: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSkillScoresJson(
  value: Prisma.JsonValue | null,
): ParsedSkillScore[] {
  if (!Array.isArray(value)) return [];
  const result: ParsedSkillScore[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      'skillCode' in entry &&
      'score' in entry &&
      typeof (entry as { skillCode: unknown }).skillCode === 'string' &&
      isFiniteNumber((entry as { score: unknown }).score)
    ) {
      result.push({
        skillCode: (entry as { skillCode: string }).skillCode,
        score: (entry as { score: number }).score,
      });
    }
  }
  return result;
}

/** Parses the full CommunicationAssessmentResult JSON stored on Roleplay/Debate sessions. */
function parseAssessmentResultJson(
  value: Prisma.JsonValue | null,
): { feedback?: string; skillScores: ParsedSkillScore[] } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    feedback: typeof record.feedback === 'string' ? record.feedback : undefined,
    skillScores: parseSkillScoresJson(
      (record.skillScores as Prisma.JsonValue) ?? null,
    ),
  };
}

/** Parses WritingSubmission.feedback, which holds only the narrative fields (no skillScores). */
function parseWritingFeedbackJson(
  value: Prisma.JsonValue | null,
): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.feedback === 'string' ? record.feedback : null;
}

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

  /**
   * Pulls skill-history points, a recent-assessments feed, and a weekly-activity count from
   * ALL FIVE completion types (activities, interviews, roleplay, debates, writing) - not just
   * Activity attempts. Activities are the only type with a normalized AssessmentScore row per
   * skill; the other four store their assessment result as a JSON blob (or, for interviews,
   * just a flat overallScore with no per-skill breakdown), so those are parsed here rather
   * than joined.
   */
  async getHistory(studentId: string) {
    const allSkills = await this.prisma.skill.findMany();
    const skillNameByCode = new Map(
      allSkills.map((s) => [s.code as string, s.name]),
    );

    const bySkill = new Map<
      string,
      {
        skillCode: string;
        skillName: string;
        points: { date: Date; score: number }[];
      }
    >();
    const addPoint = (skillCode: string, date: Date, score: number) => {
      const skillName = skillNameByCode.get(skillCode);
      if (!skillName) return;
      if (!bySkill.has(skillCode)) {
        bySkill.set(skillCode, { skillCode, skillName, points: [] });
      }
      bySkill.get(skillCode)!.points.push({ date, score });
    };

    type RecentItem = {
      id: string;
      overallScore: number;
      feedback: string;
      createdAt: Date;
    };
    const recentItems: RecentItem[] = [];

    // --- Activities: normalized AssessmentScore rows -------------------------------------
    const activityScores = await this.prisma.assessmentScore.findMany({
      where: { assessment: { attempt: { studentId } } },
      include: { skill: true, assessment: { select: { createdAt: true } } },
      orderBy: { assessment: { createdAt: 'asc' } },
    });
    for (const score of activityScores) {
      addPoint(score.skill.code, score.assessment.createdAt, score.score);
    }
    const activityAssessments = await this.prisma.assessment.findMany({
      where: { attempt: { studentId } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ASSESSMENTS_LIMIT,
      select: { id: true, overallScore: true, feedback: true, createdAt: true },
    });
    recentItems.push(...activityAssessments);

    // --- Interviews: no per-skill breakdown, always scored under the INTERVIEW skill -----
    const interviewAttempts = await this.prisma.interviewAttempt.findMany({
      where: { studentId, status: 'COMPLETED', overallScore: { not: null } },
      select: {
        id: true,
        overallScore: true,
        completedAt: true,
        createdAt: true,
      },
    });
    for (const attempt of interviewAttempts) {
      const date = attempt.completedAt ?? attempt.createdAt;
      addPoint('INTERVIEW', date, attempt.overallScore!);
      recentItems.push({
        id: attempt.id,
        overallScore: attempt.overallScore!,
        feedback: 'Completed a mock interview.',
        createdAt: date,
      });
    }

    // --- Roleplay / Debate: feedback JSON holds the full assessment result ---------------
    const roleplaySessions = await this.prisma.roleplaySession.findMany({
      where: { studentId, status: 'COMPLETED', overallScore: { not: null } },
      select: {
        id: true,
        overallScore: true,
        feedback: true,
        completedAt: true,
        createdAt: true,
      },
    });
    const debateSessions = await this.prisma.debateSession.findMany({
      where: { studentId, status: 'COMPLETED', overallScore: { not: null } },
      select: {
        id: true,
        overallScore: true,
        feedback: true,
        completedAt: true,
        createdAt: true,
      },
    });
    for (const session of [...roleplaySessions, ...debateSessions]) {
      const date = session.completedAt ?? session.createdAt;
      const parsed = parseAssessmentResultJson(session.feedback);
      for (const skillScore of parsed?.skillScores ?? []) {
        addPoint(skillScore.skillCode, date, skillScore.score);
      }
      recentItems.push({
        id: session.id,
        overallScore: session.overallScore!,
        feedback: parsed?.feedback ?? 'Completed a practice session.',
        createdAt: date,
      });
    }

    // --- Writing: skill scores live in `scores`, narrative feedback in `feedback` --------
    const writingSubmissions = await this.prisma.writingSubmission.findMany({
      where: { studentId, status: 'COMPLETED', overallScore: { not: null } },
      select: {
        id: true,
        overallScore: true,
        feedback: true,
        scores: true,
        createdAt: true,
      },
    });
    for (const submission of writingSubmissions) {
      const skillScores = parseSkillScoresJson(submission.scores);
      for (const skillScore of skillScores) {
        addPoint(skillScore.skillCode, submission.createdAt, skillScore.score);
      }
      const feedback = parseWritingFeedbackJson(submission.feedback);
      recentItems.push({
        id: submission.id,
        overallScore: submission.overallScore!,
        feedback: feedback ?? 'Completed a writing submission.',
        createdAt: submission.createdAt,
      });
    }

    const recentAssessments = recentItems
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_ASSESSMENTS_LIMIT);

    // --- Weekly activity: completion timestamps across all 5 types -----------------------
    const since = new Date();
    since.setDate(since.getDate() - WEEKLY_ACTIVITY_DAYS);
    const [
      weeklyActivities,
      weeklyInterviews,
      weeklyRoleplays,
      weeklyDebates,
      weeklyWritings,
    ] = await Promise.all([
      this.prisma.activityAttempt.findMany({
        where: { studentId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.interviewAttempt.findMany({
        where: { studentId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.roleplaySession.findMany({
        where: { studentId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.debateSession.findMany({
        where: { studentId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { completedAt: true },
      }),
      this.prisma.writingSubmission.findMany({
        where: { studentId, status: 'COMPLETED', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);
    const weeklyDates = [
      ...weeklyActivities.map((a) => a.completedAt),
      ...weeklyInterviews.map((a) => a.completedAt),
      ...weeklyRoleplays.map((a) => a.completedAt),
      ...weeklyDebates.map((a) => a.completedAt),
      ...weeklyWritings.map((a) => a.createdAt),
    ].filter((d): d is Date => d !== null);
    const weeklyActivity = this.groupByDay(weeklyDates);

    return {
      skillHistory: Array.from(bySkill.values()),
      recentAssessments,
      weeklyActivity,
    };
  }

  private groupByDay(dates: Date[]): { date: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const date of dates) {
      const key = appDayKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
