import { jest } from '@jest/globals';
import { RoleplayService } from './roleplay.service.js';

describe('RoleplayService.listSessions', () => {
  it("returns only the student's sessions for the scenario, newest first, with ordered messages", async () => {
    const sessions = [{ id: 's2' }, { id: 's1' }];
    const findMany = jest.fn(() => sessions);
    const count = jest.fn(() => 12);
    const prisma = {
      roleplaySession: { findMany, count },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new RoleplayService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listSessions('student-1', 'rp-1', 2, 5);

    expect(findMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', roleplayId: 'rp-1' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(count).toHaveBeenCalledWith({
      where: { studentId: 'student-1', roleplayId: 'rp-1' },
    });
    expect(result).toEqual({
      items: sessions,
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
  });
});
