import { Injectable } from '@nestjs/common';
import { Prisma } from '#prisma-client';
import {
  addDays,
  APP_TIMEZONE,
  appDay,
  appDayKey,
  localMidnight,
} from '../common/utils/app-day.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  /** Whether something was completed today - drives "streak ends tonight" warnings in the app. */
  practicedToday: boolean;
}

export interface StreakCalendar extends StreakSummary {
  /** "YYYY-MM" that was requested. */
  month: string;
  /** Local date the server considers "today" ("YYYY-MM-DD"), so the app highlights the same day. */
  today: string;
  timeZone: string;
  /** Only days with at least one completed practice, oldest first. */
  days: { date: string; count: number }[];
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Daily-practice streak. A calendar day (in APP_TIMEZONE) only counts once the student has
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

    const today = appDay(new Date());

    if (student.lastStreakDate && isSameDay(student.lastStreakDate, today)) {
      return;
    }

    const isConsecutiveDay =
      student.lastStreakDate &&
      isSameDay(addDays(student.lastStreakDate, 1), today);
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

    const today = appDay(new Date());
    const isActiveToday = Boolean(
      student.lastStreakDate && isSameDay(student.lastStreakDate, today),
    );
    const isBrokenSinceYesterday = Boolean(
      student.lastStreakDate &&
      !isActiveToday &&
      !isSameDay(addDays(student.lastStreakDate, 1), today),
    );

    return {
      currentStreak: isBrokenSinceYesterday ? 0 : student.currentStreak,
      longestStreak: student.longestStreak,
      practicedToday: isActiveToday,
    };
  }

  /** No settings row yet = reminders on (the default). */
  async getReminderPreference(studentId: string) {
    const setting = await this.prisma.streakReminderSetting.findUnique({
      where: { studentId },
      select: { emailEnabled: true },
    });
    return { streakReminderEmails: setting?.emailEnabled ?? true };
  }

  async setReminderPreference(studentId: string, enabled: boolean) {
    const setting = await this.prisma.streakReminderSetting.upsert({
      where: { studentId },
      create: { studentId, emailEnabled: enabled },
      update: { emailEnabled: enabled },
      select: { emailEnabled: true },
    });
    return { streakReminderEmails: setting.emailEnabled };
  }

  /**
   * Practice counts per local day for one month - what the streak calendar colours in.
   * Derived from completion timestamps across all five practice types (the same events that
   * advance the streak), so it needs no extra table and covers history from before this existed.
   */
  async getCalendar(studentId: string, month: string): Promise<StreakCalendar> {
    const [year, monthNumber] = month.split('-').map(Number);
    const from = localMidnight(year, monthNumber, 1);
    const to = localMidnight(year, monthNumber + 1, 1);
    const inMonth = { gte: from, lt: to };

    const [summary, activities, interviews, roleplays, debates, writings] =
      await Promise.all([
        this.getSummary(studentId),
        this.prisma.activityAttempt.findMany({
          where: { studentId, status: 'COMPLETED', completedAt: inMonth },
          select: { completedAt: true },
        }),
        this.prisma.interviewAttempt.findMany({
          where: { studentId, status: 'COMPLETED', completedAt: inMonth },
          select: { completedAt: true },
        }),
        this.prisma.roleplaySession.findMany({
          where: { studentId, status: 'COMPLETED', completedAt: inMonth },
          select: { completedAt: true },
        }),
        this.prisma.debateSession.findMany({
          where: { studentId, status: 'COMPLETED', completedAt: inMonth },
          select: { completedAt: true },
        }),
        this.prisma.writingSubmission.findMany({
          where: { studentId, status: 'COMPLETED', createdAt: inMonth },
          select: { createdAt: true },
        }),
      ]);

    const counts = new Map<string, number>();
    const stamps = [
      ...activities.map((a) => a.completedAt),
      ...interviews.map((a) => a.completedAt),
      ...roleplays.map((a) => a.completedAt),
      ...debates.map((a) => a.completedAt),
      ...writings.map((a) => a.createdAt),
    ];
    for (const stamp of stamps) {
      if (!stamp) continue;
      const key = appDayKey(stamp);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return {
      ...summary,
      month,
      today: appDayKey(new Date()),
      timeZone: APP_TIMEZONE,
      days: [...counts.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
