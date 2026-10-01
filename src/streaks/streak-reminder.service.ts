import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { addDays, appDay, APP_TIMEZONE } from '../common/utils/app-day.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Local hour (APP_TIMEZONE) from which the evening reminder goes out. */
export const REMINDER_HOUR = 19;
/** No reminders this late - better to skip than to ping at midnight. */
const REMINDER_LAST_HOUR = 22;
const CHECK_EVERY_MS = 10 * 60 * 1000;
const BATCH_SIZE = 200;

function localHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date),
  );
}

/**
 * Evening email when a running streak will break at midnight: the student practised
 * yesterday but not yet today. Runs in-process every 10 minutes (no extra scheduler package)
 * and claims each student atomically per day, so restarts or several instances never send twice.
 */
@Injectable()
export class StreakReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreakReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    // Never let a failed pass (e.g. DB unreachable) become an unhandled rejection.
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`Streak reminder pass failed: ${String(err)}`),
      );
    }, CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass; returns how many reminders were sent. Public for tests. */
  async tick(now = new Date()): Promise<number> {
    const hour = localHour(now);
    if (this.running || hour < REMINDER_HOUR || hour > REMINDER_LAST_HOUR)
      return 0;
    this.running = true;
    try {
      const today = appDay(now);
      const yesterday = addDays(today, -1);
      // Streak alive through yesterday but nothing done today = it breaks at midnight.
      const atRisk = await this.prisma.studentProfile.findMany({
        where: {
          currentStreak: { gt: 0 },
          lastStreakDate: yesterday,
          user: { isActive: true },
        },
        select: {
          id: true,
          firstName: true,
          currentStreak: true,
          user: { select: { email: true } },
          streakReminder: {
            select: { emailEnabled: true, lastSentDate: true },
          },
        },
        take: BATCH_SIZE * 2,
      });
      const due = atRisk
        .filter((s) => s.streakReminder?.emailEnabled !== false)
        .filter(
          (s) =>
            !s.streakReminder?.lastSentDate ||
            s.streakReminder.lastSentDate < today,
        )
        .slice(0, BATCH_SIZE);

      let sent = 0;
      for (const student of due) {
        if (!(await this.claim(student.id, today))) continue;

        const days = student.currentStreak;
        try {
          await this.emailService.send({
            to: student.user.email,
            subject: `🔥 Your ${days}-day streak ends at midnight`,
            text: [
              `Hi ${student.firstName},`,
              '',
              `You've practised ${days} day${days === 1 ? '' : 's'} in a row - one quick activity tonight keeps your streak alive.`,
              '',
              'Open Communication Assistant and record a 1-minute answer.',
              '',
              '(Turn these reminders off anytime in Profile.)',
            ].join('\n'),
          });
          sent++;
        } catch (err) {
          this.logger.warn(
            `Streak reminder to ${student.id} failed: ${String(err)}`,
          );
        }
      }
      if (sent > 0) this.logger.log(`Sent ${sent} streak reminder(s).`);
      return sent;
    } finally {
      this.running = false;
    }
  }

  /** Marks today's reminder as sent for this student; false if another pass already did. */
  private async claim(studentId: string, today: Date): Promise<boolean> {
    const updated = await this.prisma.streakReminderSetting.updateMany({
      where: {
        studentId,
        emailEnabled: true,
        OR: [{ lastSentDate: null }, { lastSentDate: { lt: today } }],
      },
      data: { lastSentDate: today },
    });
    if (updated.count === 1) return true;
    const existing = await this.prisma.streakReminderSetting.findUnique({
      where: { studentId },
    });
    if (existing) return false;
    try {
      await this.prisma.streakReminderSetting.create({
        data: { studentId, lastSentDate: today },
      });
      return true;
    } catch {
      return false; // another pass created it first
    }
  }
}
