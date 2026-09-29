import { Injectable } from '@nestjs/common';
import { Prisma } from '#prisma-client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Daily-practice streak. A calendar day (UTC) only counts once the student has
 * completed something - starting-and-abandoning an activity doesn't count, so the
 * streak can't be gamed by opening and not finishing. Deliberately no freeze/grace-day
 * mechanic yet; the rule is simple on purpose. Call sites: every "complete" transaction
 * across activities, interviews, roleplay, debates, and writing submissions.
 */
@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async recordCompletion(
    studentId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const student = await tx.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastStreakDate: true,
      },
    });

    const today = startOfUtcDay(new Date());

    if (student.lastStreakDate && isSameUtcDay(student.lastStreakDate, today)) {
      return;
    }

    const isConsecutiveDay =
      student.lastStreakDate &&
      isSameUtcDay(addUtcDays(student.lastStreakDate, 1), today);
    const nextStreak = isConsecutiveDay ? student.currentStreak + 1 : 1;

    await tx.studentProfile.update({
      where: { id: studentId },
      data: {
        currentStreak: nextStreak,
        longestStreak: Math.max(nextStreak, student.longestStreak),
        lastStreakDate: today,
      },
    });
  }

  async getSummary(studentId: string): Promise<StreakSummary> {
    const student = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastStreakDate: true,
      },
    });

    const today = startOfUtcDay(new Date());
    const isActiveToday = Boolean(
      student.lastStreakDate && isSameUtcDay(student.lastStreakDate, today),
    );
    const isBrokenSinceYesterday = Boolean(
      student.lastStreakDate &&
      !isActiveToday &&
      !isSameUtcDay(addUtcDays(student.lastStreakDate, 1), today),
    );

    return {
      currentStreak: isBrokenSinceYesterday ? 0 : student.currentStreak,
      longestStreak: student.longestStreak,
    };
  }
}
