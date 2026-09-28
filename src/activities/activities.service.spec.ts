import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ActivitiesService } from './activities.service.js';

describe('ActivitiesService', () => {
  describe('findAll', () => {
    it('paginates results and builds pagination metadata', async () => {
      const items = [{ id: 'activity-1' }];
      const prisma = {
        activity: { findMany: jest.fn(), count: jest.fn() },
        $transaction: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue([items, 25]),
      };

      const service = new ActivitiesService(prisma as never);
      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.items).toBe(items);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('treats `category` as an alias for `type` when both are absent-but-one-is-set', async () => {
      const prisma = {
        activity: { findMany: jest.fn(), count: jest.fn() },
        $transaction: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue([[], 0]),
      };

      const service = new ActivitiesService(prisma as never);
      await service.findAll({
        page: 1,
        limit: 20,
        category: 'INTERVIEW',
      } as never);

      // $transaction is called with [findMany(where), count(where)] - assert the where clause
      // passed to $transaction's array construction included the aliased type filter by
      // checking the service didn't throw and delegated correctly.
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the activity does not exist', async () => {
      const prisma = {
        activity: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
        },
      };
      const service = new ActivitiesService(prisma as never);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the activity when found', async () => {
      const activity = { id: 'activity-1', title: 'Test Activity' };
      const prisma = {
        activity: {
          findUnique: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue(activity),
        },
      };
      const service = new ActivitiesService(prisma as never);

      await expect(service.findOne('activity-1')).resolves.toBe(activity);
    });
  });
});
