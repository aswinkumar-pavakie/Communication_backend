import { jest } from '@jest/globals';
import { ProgressService } from './progress.service.js';

describe('ProgressService', () => {
  describe('applyAssessment', () => {
    it('creates a new Progress row with STABLE trend when none existed before', async () => {
      const skill = { id: 'skill-1', code: 'GRAMMAR' };
      const tx = {
        skill: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue([skill]),
        },
        progress: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
          upsert: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };

      const service = new ProgressService({} as never);
      await service.applyAssessment(
        'student-1',
        [{ skillCode: 'GRAMMAR', score: 70 }],
        tx as never,
      );

      expect(tx.progress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            currentScore: 70,
            previousScore: null,
            trend: 'STABLE',
          }),
        }),
      );
    });

    it('marks the trend IMPROVING when the new score is higher than the previous score', async () => {
      const skill = { id: 'skill-1', code: 'FLUENCY' };
      const tx = {
        skill: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue([skill]),
        },
        progress: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ currentScore: 50 }),
          upsert: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };

      const service = new ProgressService({} as never);
      await service.applyAssessment(
        'student-1',
        [{ skillCode: 'FLUENCY', score: 65 }],
        tx as never,
      );

      expect(tx.progress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            previousScore: 50,
            currentScore: 65,
            trend: 'IMPROVING',
          }),
        }),
      );
    });

    it('marks the trend DECLINING when the new score is lower than the previous score', async () => {
      const skill = { id: 'skill-1', code: 'CONFIDENCE' };
      const tx = {
        skill: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue([skill]),
        },
        progress: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ currentScore: 80 }),
          upsert: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };

      const service = new ProgressService({} as never);
      await service.applyAssessment(
        'student-1',
        [{ skillCode: 'CONFIDENCE', score: 60 }],
        tx as never,
      );

      expect(tx.progress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ trend: 'DECLINING' }),
        }),
      );
    });
  });

  describe('getOverview', () => {
    it('averages current scores across skills and rounds to the nearest integer', async () => {
      const prisma = {
        progress: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              currentScore: 70,
              previousScore: 60,
              trend: 'IMPROVING',
              lastAssessedAt: new Date(),
              skill: { code: 'GRAMMAR', name: 'Grammar' },
            },
            {
              currentScore: 81,
              previousScore: 81,
              trend: 'STABLE',
              lastAssessedAt: new Date(),
              skill: { code: 'FLUENCY', name: 'Fluency' },
            },
          ]),
        },
      };

      const service = new ProgressService(prisma as never);
      const overview = await service.getOverview('student-1');

      expect(overview.overallScore).toBe(76); // round((70+81)/2)
      expect(overview.skills).toHaveLength(2);
    });

    it('returns zero overall score when the student has no progress yet', async () => {
      const prisma = {
        progress: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([]),
        },
      };
      const service = new ProgressService(prisma as never);
      const overview = await service.getOverview('student-1');
      expect(overview.overallScore).toBe(0);
      expect(overview.skills).toEqual([]);
    });
  });

  describe('getHistory', () => {
    function buildPrisma(overrides: {
      skills?: unknown[];
      activityScores?: unknown[];
      activityAssessments?: unknown[];
      interviewAttempts?: unknown[];
      roleplaySessions?: unknown[];
      debateSessions?: unknown[];
      writingSubmissions?: unknown[];
      weeklyActivityAttempts?: unknown[];
      weeklyInterviewAttempts?: unknown[];
      weeklyRoleplaySessions?: unknown[];
      weeklyDebateSessions?: unknown[];
      weeklyWritingSubmissions?: unknown[];
    }) {
      // findMany is called twice each for activityAttempt/interviewAttempt/roleplaySession/
      // debateSession/writingSubmission (once for history, once for the weekly-activity
      // Promise.all block) - mockResolvedValueOnce twice, in call order, keeps each call
      // returning the right fixture.
      const activityAttempt = {
        findMany: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(overrides.weeklyActivityAttempts ?? []),
      };
      const interviewAttempt = {
        findMany: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(overrides.interviewAttempts ?? [])
          .mockResolvedValueOnce(overrides.weeklyInterviewAttempts ?? []),
      };
      const roleplaySession = {
        findMany: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(overrides.roleplaySessions ?? [])
          .mockResolvedValueOnce(overrides.weeklyRoleplaySessions ?? []),
      };
      const debateSession = {
        findMany: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(overrides.debateSessions ?? [])
          .mockResolvedValueOnce(overrides.weeklyDebateSessions ?? []),
      };
      const writingSubmission = {
        findMany: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValueOnce(overrides.writingSubmissions ?? [])
          .mockResolvedValueOnce(overrides.weeklyWritingSubmissions ?? []),
      };

      return {
        skill: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue(overrides.skills ?? []),
        },
        assessmentScore: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue(overrides.activityScores ?? []),
        },
        assessment: {
          findMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue(overrides.activityAssessments ?? []),
        },
        interviewAttempt,
        roleplaySession,
        debateSession,
        writingSubmission,
        activityAttempt,
      };
    }

    it('includes an INTERVIEW skill-history point and a synthesized feedback string for completed interviews', async () => {
      const date = new Date('2026-09-20T10:00:00Z');
      const prisma = buildPrisma({
        skills: [{ id: 's1', code: 'INTERVIEW', name: 'Interview Skills' }],
        interviewAttempts: [
          { id: 'ia1', overallScore: 72, completedAt: date, createdAt: date },
        ],
      });

      const service = new ProgressService(prisma as never);
      const history = await service.getHistory('student-1');

      expect(history.skillHistory).toEqual([
        {
          skillCode: 'INTERVIEW',
          skillName: 'Interview Skills',
          points: [{ date, score: 72 }],
        },
      ]);
      expect(history.recentAssessments).toContainEqual(
        expect.objectContaining({
          id: 'ia1',
          overallScore: 72,
          feedback: 'Completed a mock interview.',
        }),
      );
    });

    it('parses skillScores out of Roleplay/Debate JSON feedback and includes the narrative feedback text', async () => {
      const date = new Date('2026-09-21T10:00:00Z');
      const prisma = buildPrisma({
        skills: [
          { id: 's1', code: 'PROFESSIONAL_TONE', name: 'Professional Tone' },
        ],
        roleplaySessions: [
          {
            id: 'rp1',
            overallScore: 68,
            completedAt: date,
            createdAt: date,
            feedback: {
              feedback: 'Handled the conversation professionally.',
              skillScores: [{ skillCode: 'PROFESSIONAL_TONE', score: 68 }],
            },
          },
        ],
      });

      const service = new ProgressService(prisma as never);
      const history = await service.getHistory('student-1');

      expect(history.skillHistory).toEqual([
        {
          skillCode: 'PROFESSIONAL_TONE',
          skillName: 'Professional Tone',
          points: [{ date, score: 68 }],
        },
      ]);
      expect(history.recentAssessments).toContainEqual(
        expect.objectContaining({
          id: 'rp1',
          feedback: 'Handled the conversation professionally.',
        }),
      );
    });

    it('parses Writing skillScores from the separate `scores` JSON column', async () => {
      const date = new Date('2026-09-22T10:00:00Z');
      const prisma = buildPrisma({
        skills: [{ id: 's1', code: 'GRAMMAR', name: 'Grammar' }],
        writingSubmissions: [
          {
            id: 'w1',
            overallScore: 55,
            createdAt: date,
            feedback: { feedback: 'Solid structure, minor grammar slips.' },
            scores: [{ skillCode: 'GRAMMAR', score: 55 }],
          },
        ],
      });

      const service = new ProgressService(prisma as never);
      const history = await service.getHistory('student-1');

      expect(history.skillHistory).toEqual([
        {
          skillCode: 'GRAMMAR',
          skillName: 'Grammar',
          points: [{ date, score: 55 }],
        },
      ]);
      expect(history.recentAssessments).toContainEqual(
        expect.objectContaining({
          id: 'w1',
          feedback: 'Solid structure, minor grammar slips.',
        }),
      );
    });

    it('silently skips malformed/null JSON instead of throwing', async () => {
      const date = new Date('2026-09-23T10:00:00Z');
      const prisma = buildPrisma({
        skills: [{ id: 's1', code: 'GRAMMAR', name: 'Grammar' }],
        roleplaySessions: [
          {
            id: 'rp1',
            overallScore: 40,
            completedAt: date,
            createdAt: date,
            feedback: null,
          },
        ],
        writingSubmissions: [
          {
            id: 'w1',
            overallScore: 40,
            createdAt: date,
            feedback: null,
            scores: 'not-an-array',
          },
        ],
      });

      const service = new ProgressService(prisma as never);
      const history = await service.getHistory('student-1');

      expect(history.skillHistory).toEqual([]);
      expect(history.recentAssessments).toContainEqual(
        expect.objectContaining({
          id: 'rp1',
          feedback: 'Completed a practice session.',
        }),
      );
      expect(history.recentAssessments).toContainEqual(
        expect.objectContaining({
          id: 'w1',
          feedback: 'Completed a writing submission.',
        }),
      );
    });

    it('merges weekly-activity dates from all 5 completion types and groups them by day', async () => {
      const day1 = new Date('2026-09-20T08:00:00Z');
      // 20:30 IST - still the same local day (days are grouped in APP_TIMEZONE, not UTC).
      const day1Later = new Date('2026-09-20T15:00:00Z');
      const day2 = new Date('2026-09-21T08:00:00Z');
      const prisma = buildPrisma({
        weeklyActivityAttempts: [{ completedAt: day1 }],
        weeklyInterviewAttempts: [{ completedAt: day1Later }],
        weeklyRoleplaySessions: [{ completedAt: day2 }],
        weeklyDebateSessions: [],
        weeklyWritingSubmissions: [{ createdAt: day2 }],
      });

      const service = new ProgressService(prisma as never);
      const history = await service.getHistory('student-1');

      expect(history.weeklyActivity).toEqual([
        { date: '2026-09-20', count: 2 },
        { date: '2026-09-21', count: 2 },
      ]);
    });
  });
});
