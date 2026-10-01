import { jest } from '@jest/globals';
import { StreakReminderService } from './streak-reminder.service.js';

// 20:00 IST on 2026-09-30 == 14:30 UTC.
const EVENING_IST = new Date('2026-09-30T14:30:00Z');
const MORNING_IST = new Date('2026-09-30T04:30:00Z');

function build(students: unknown[]) {
  const prisma = {
    studentProfile: {
      findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue(students),
    },
    streakReminderSetting: {
      updateMany: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ count: 0 }),
      findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
      create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    },
  };
  const email = { send: jest.fn<() => Promise<void>>().mockResolvedValue() };
  return {
    service: new StreakReminderService(prisma as never, email as never),
    prisma,
    email,
  };
}

const student = (id: string, streakReminder: unknown = null) => ({
  id,
  firstName: 'Asha',
  currentStreak: 4,
  user: { email: `${id}@college.edu` },
  streakReminder,
});

describe('StreakReminderService.tick', () => {
  it('does nothing outside the evening window', async () => {
    const { service, prisma } = build([student('s1')]);
    expect(await service.tick(MORNING_IST)).toBe(0);
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it('emails students whose streak breaks tonight, skipping opted-out and already-reminded ones', async () => {
    const { service, email, prisma } = build([
      student('s1'),
      student('s2', { emailEnabled: false, lastSentDate: null }),
      student('s3', {
        emailEnabled: true,
        lastSentDate: new Date('2026-09-30T00:00:00Z'),
      }),
    ]);

    expect(await service.tick(EVENING_IST)).toBe(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(
      (
        email.send.mock.calls[0] as unknown as [{ to: string; subject: string }]
      )[0],
    ).toMatchObject({
      to: 's1@college.edu',
      subject: '🔥 Your 4-day streak ends at midnight',
    });
    // Only yesterday-active streaks are considered.
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lastStreakDate: new Date('2026-09-29T00:00:00Z'),
        }),
      }),
    );
  });

  it('does not send twice when another pass already claimed the student', async () => {
    const { service, email, prisma } = build([student('s1')]);
    prisma.streakReminderSetting.findUnique.mockResolvedValueOnce({
      studentId: 's1',
    });
    expect(await service.tick(EVENING_IST)).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });
});
