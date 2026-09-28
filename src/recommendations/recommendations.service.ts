import { Injectable } from '@nestjs/common';
import { Prisma, SkillCode } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

const LOW_SCORE_THRESHOLD = 60;

/**
 * Rule-based recommendation reasons per skill. This is deliberately simple and isolated
 * so it can be swapped for an AI-driven engine later without touching callers - they only
 * ever depend on RecommendationsService.refreshForStudent().
 */
const SKILL_REASONS: Partial<Record<SkillCode, string>> = {
  FLUENCY:
    'Your fluency score is below target - practice more speaking activities to build flow.',
  GRAMMAR:
    'Your grammar score is below target - practice grammar-focused exercises.',
  CONFIDENCE:
    'Your confidence score is below target - try short, low-pressure speaking practice.',
  INTERVIEW:
    'Your interview readiness is below target - practice mock HR interview questions.',
  VOCABULARY:
    'Your vocabulary score is below target - practice vocabulary-building activities.',
  PRONUNCIATION:
    'Your pronunciation score is below target - practice reading aloud exercises.',
  CLARITY:
    'Your clarity score is below target - focus on structuring your responses more clearly.',
  PROFESSIONAL_TONE:
    'Your professional tone score is below target - practice workplace communication scenarios.',
  CRITICAL_THINKING:
    'Your critical thinking score is below target - try debate or argument-structuring activities.',
  TECHNICAL_COMMUNICATION:
    'Your technical communication score is below target - practice explaining technical concepts simply.',
  LISTENING:
    'Your listening score is below target - practice listening comprehension activities.',
};

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recomputes pending recommendations for a student based on their latest Progress rows. */
  async refreshForStudent(
    studentId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const progress = await tx.progress.findMany({
      where: { studentId },
      include: { skill: true },
    });
    const lowSkillIds = progress
      .filter((p) => p.currentScore < LOW_SCORE_THRESHOLD)
      .map((p) => p.skillId);

    await tx.recommendation.deleteMany({
      where: {
        studentId,
        status: 'PENDING',
        skillId: { notIn: lowSkillIds.length ? lowSkillIds : ['__none__'] },
      },
    });

    for (const p of progress) {
      if (p.currentScore >= LOW_SCORE_THRESHOLD) continue;

      const existing = await tx.recommendation.findFirst({
        where: { studentId, skillId: p.skillId, status: 'PENDING' },
      });
      if (existing) continue;

      const suggestedActivity = await tx.activity.findFirst({
        where: { skillId: p.skillId, isActive: true },
        orderBy: { difficulty: 'asc' },
      });

      await tx.recommendation.create({
        data: {
          studentId,
          skillId: p.skillId,
          activityId: suggestedActivity?.id,
          reason:
            SKILL_REASONS[p.skill.code] ??
            `Improve your ${p.skill.name} through targeted practice.`,
          priority: Math.round(100 - p.currentScore),
        },
      });
    }
  }

  findForStudent(studentId: string, limit = 10) {
    return this.prisma.recommendation.findMany({
      where: { studentId, status: 'PENDING' },
      include: { skill: true, activity: true },
      orderBy: { priority: 'desc' },
      take: limit,
    });
  }
}
