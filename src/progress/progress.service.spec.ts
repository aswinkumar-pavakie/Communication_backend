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
});
