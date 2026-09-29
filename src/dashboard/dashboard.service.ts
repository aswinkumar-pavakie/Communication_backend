import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { RecommendationsService } from '../recommendations/recommendations.service.js';
import { StreaksService } from '../streaks/streaks.service.js';

const TODAY_ACTIVITY_LIMIT = 5;
const RECOMMENDATION_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly recommendationsService: RecommendationsService,
    private readonly streaksService: StreaksService,
  ) {}

  async getDashboard(studentId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: { select: { email: true } } },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    const { overallScore, skills } =
      await this.progressService.getOverview(studentId);
    const recommendations = await this.recommendationsService.findForStudent(
      studentId,
      RECOMMENDATION_LIMIT,
    );

    const todayActivities = await this.getTodayActivities(
      studentId,
      recommendations,
    );

    const recentActivity = await this.prisma.activityAttempt.findMany({
      where: { studentId, status: 'COMPLETED' },
      include: { activity: { select: { title: true, type: true } } },
      orderBy: { completedAt: 'desc' },
      take: RECENT_ACTIVITY_LIMIT,
    });

    const placementReadiness = this.computePlacementReadiness(
      overallScore,
      skills,
    );
    const streak = await this.streaksService.getSummary(studentId);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        department: student.department,
        year: student.year,
        batch: student.batch,
      },
      overallScore,
      skills,
      todayActivities,
      recommendations: recommendations.map((r) => ({
        id: r.id,
        skillCode: r.skill.code,
        reason: r.reason,
        priority: r.priority,
        activity: r.activity
          ? { id: r.activity.id, title: r.activity.title }
          : null,
      })),
      recentActivity: recentActivity.map((a) => ({
        attemptId: a.id,
        activityTitle: a.activity.title,
        activityType: a.activity.type,
        overallScore: a.overallScore,
        completedAt: a.completedAt,
      })),
      placementReadiness,
      streak,
    };
  }

  private async getTodayActivities(
    studentId: string,
    recommendations: Awaited<
      ReturnType<RecommendationsService['findForStudent']>
    >,
  ) {
    const recommendedActivityIds = recommendations
      .map((r) => r.activity?.id)
      .filter((id): id is string => Boolean(id));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completedTodayIds = (
      await this.prisma.activityAttempt.findMany({
        where: {
          studentId,
          status: 'COMPLETED',
          completedAt: { gte: startOfToday },
        },
        select: { activityId: true },
      })
    ).map((a) => a.activityId);

    const activities = await this.prisma.activity.findMany({
      where: {
        isActive: true,
        id: recommendedActivityIds.length
          ? { in: recommendedActivityIds }
          : undefined,
        NOT: completedTodayIds.length
          ? { id: { in: completedTodayIds } }
          : undefined,
      },
      include: { skill: true },
      take: TODAY_ACTIVITY_LIMIT,
    });

    if (activities.length >= TODAY_ACTIVITY_LIMIT) {
      return activities;
    }

    const fallback = await this.prisma.activity.findMany({
      where: {
        isActive: true,
        NOT: completedTodayIds.length
          ? { id: { in: completedTodayIds } }
          : undefined,
      },
      include: { skill: true },
      orderBy: { createdAt: 'desc' },
      take: TODAY_ACTIVITY_LIMIT,
    });

    const merged = [
      ...activities,
      ...fallback.filter((f) => !activities.some((a) => a.id === f.id)),
    ];
    return merged.slice(0, TODAY_ACTIVITY_LIMIT);
  }

  private computePlacementReadiness(
    overallScore: number,
    skills: Awaited<ReturnType<ProgressService['getOverview']>>['skills'],
  ) {
    const interviewSkill = skills.find((s) => s.skillCode === 'INTERVIEW');
    const readinessScore = interviewSkill
      ? Math.round((interviewSkill.currentScore + overallScore) / 2)
      : overallScore;

    const label =
      readinessScore >= 75
        ? 'READY'
        : readinessScore >= 50
          ? 'DEVELOPING'
          : 'NEEDS_PRACTICE';

    return { score: readinessScore, label };
  }
}
