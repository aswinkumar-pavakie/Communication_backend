import { jest } from '@jest/globals';
import { StreaksService } from './streaks.service.js';

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function fakePrisma(student: {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
}) {
  const update = jest.fn<() => Promise<unknown>>().mockResolvedValue({});
  return {
    studentProfile: {
      findUniqueOrThrow: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue(student),
      update,
    },
  };
}

describe('StreaksService', () => {
  function mockToday(isoDate: string) {
    jest.useFakeTimers({ now: utcDate(isoDate) });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('recordCompletion', () => {
    it('starts a streak at 1 for a student with no prior streak', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 0,
        longestStreak: 0,
        lastStreakDate: null,
      });
      const service = new StreaksService(prisma as never);

      await service.recordCompletion('student-1');

      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: {
          currentStreak: 1,
          longestStreak: 1,
          lastStreakDate: utcDate('2026-09-28'),
        },
      });
    });

    it('increments the streak on a consecutive day', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 4,
        longestStreak: 4,
        lastStreakDate: utcDate('2026-09-27'),
      });
      const service = new StreaksService(prisma as never);

      await service.recordCompletion('student-1');

      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: {
          currentStreak: 5,
          longestStreak: 5,
          lastStreakDate: utcDate('2026-09-28'),
        },
      });
    });

    it('resets the streak to 1 after a missed day', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 10,
        longestStreak: 12,
        lastStreakDate: utcDate('2026-09-25'),
      });
      const service = new StreaksService(prisma as never);

      await service.recordCompletion('student-1');

      expect(prisma.studentProfile.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: {
          currentStreak: 1,
          longestStreak: 12,
          lastStreakDate: utcDate('2026-09-28'),
        },
      });
    });

    it('does not double-count a second completion on the same day', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 3,
        longestStreak: 3,
        lastStreakDate: utcDate('2026-09-28'),
      });
      const service = new StreaksService(prisma as never);

      await service.recordCompletion('student-1');

      expect(prisma.studentProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('reports the stored streak when it is still active today', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 5,
        longestStreak: 8,
        lastStreakDate: utcDate('2026-09-28'),
      });
      const service = new StreaksService(prisma as never);

      await expect(service.getSummary('student-1')).resolves.toEqual({
        currentStreak: 5,
        longestStreak: 8,
        practicedToday: true,
      });
    });

    it('reports the stored streak when yesterday still keeps it alive', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 5,
        longestStreak: 8,
        lastStreakDate: utcDate('2026-09-27'),
      });
      const service = new StreaksService(prisma as never);

      await expect(service.getSummary('student-1')).resolves.toEqual({
        currentStreak: 5,
        longestStreak: 8,
        practicedToday: false,
      });
    });

    it('reports 0 when the streak was broken (no completion for 2+ days)', async () => {
      mockToday('2026-09-28');
      const prisma = fakePrisma({
        currentStreak: 5,
        longestStreak: 8,
        lastStreakDate: utcDate('2026-09-20'),
      });
      const service = new StreaksService(prisma as never);

      await expect(service.getSummary('student-1')).resolves.toEqual({
        currentStreak: 0,
        longestStreak: 8,
        practicedToday: false,
      });
    });
  });
});

describe('StreaksService.getCalendar', () => {
  afterEach(() => jest.useRealTimers());

  it('counts completions per local (IST) day across all practice types for the month', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-30T06:00:00Z') });
    const stamps = (isoList: string[], field = 'completedAt') =>
      jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue(isoList.map((iso) => ({ [field]: new Date(iso) })));
    const prisma = {
      studentProfile: {
        findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          currentStreak: 2,
          longestStreak: 4,
          lastStreakDate: new Date('2026-09-30T00:00:00Z'),
        }),
      },
      // 20:00 UTC on the 28th is 01:30 IST on the 29th.
      activityAttempt: {
        findMany: stamps(['2026-09-28T20:00:00Z', '2026-09-29T05:00:00Z']),
      },
      interviewAttempt: { findMany: stamps(['2026-09-30T04:00:00Z']) },
      roleplaySession: { findMany: stamps([]) },
      debateSession: { findMany: stamps(['2026-09-02T10:00:00Z']) },
      writingSubmission: {
        findMany: stamps(['2026-09-30T05:00:00Z'], 'createdAt'),
      },
    };

    const result = await new StreaksService(prisma as never).getCalendar(
      's1',
      '2026-09',
    );

    expect(result.days).toEqual([
      { date: '2026-09-02', count: 1 },
      { date: '2026-09-29', count: 2 },
      { date: '2026-09-30', count: 2 },
    ]);
    expect(result).toMatchObject({
      month: '2026-09',
      today: '2026-09-30',
      currentStreak: 2,
      longestStreak: 4,
    });
    // Month boundaries are local midnight in IST.
    expect(prisma.activityAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          completedAt: {
            gte: new Date('2026-08-31T18:30:00.000Z'),
            lt: new Date('2026-09-30T18:30:00.000Z'),
          },
        }),
      }),
    );
  });
});
