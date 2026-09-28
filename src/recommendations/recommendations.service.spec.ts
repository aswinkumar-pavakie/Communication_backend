import { jest } from '@jest/globals';
import { RecommendationsService } from './recommendations.service.js';

describe('RecommendationsService', () => {
  describe('refreshForStudent', () => {
    it('creates a recommendation for a skill below the threshold that has no pending recommendation yet', async () => {
      const tx = {
        progress: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              skillId: 'skill-fluency',
              currentScore: 45,
              skill: { code: 'FLUENCY', name: 'Fluency' },
            },
          ]),
        },
        recommendation: {
          deleteMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
          findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
          create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
        activity: {
          findFirst: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ id: 'activity-1' }),
        },
      };

      const service = new RecommendationsService({} as never);
      await service.refreshForStudent('student-1', tx as never);

      expect(tx.recommendation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student-1',
            skillId: 'skill-fluency',
          }),
        }),
      );
    });

    it('does not create a duplicate recommendation when one is already pending for that skill', async () => {
      const tx = {
        progress: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              skillId: 'skill-fluency',
              currentScore: 45,
              skill: { code: 'FLUENCY', name: 'Fluency' },
            },
          ]),
        },
        recommendation: {
          deleteMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
          findFirst: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ id: 'existing' }),
          create: jest.fn(),
        },
        activity: { findFirst: jest.fn() },
      };

      const service = new RecommendationsService({} as never);
      await service.refreshForStudent('student-1', tx as never);

      expect(tx.recommendation.create).not.toHaveBeenCalled();
    });

    it('does not create a recommendation for a skill at or above the threshold', async () => {
      const tx = {
        progress: {
          findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([
            {
              skillId: 'skill-grammar',
              currentScore: 90,
              skill: { code: 'GRAMMAR', name: 'Grammar' },
            },
          ]),
        },
        recommendation: {
          deleteMany: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        activity: { findFirst: jest.fn() },
      };

      const service = new RecommendationsService({} as never);
      await service.refreshForStudent('student-1', tx as never);

      expect(tx.recommendation.create).not.toHaveBeenCalled();
    });
  });
});
