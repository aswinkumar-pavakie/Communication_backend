import { jest } from '@jest/globals';
import { DebatesService } from './debates.service.js';

describe('DebatesService.listSessions', () => {
  it("returns only the student's sessions for the topic, newest first, with ordered messages", async () => {
    const sessions = [{ id: 'd1', studentPosition: 'FOR' }];
    const findMany = jest.fn(() => sessions);
    const count = jest.fn(() => 1);
    const prisma = {
      debateSession: { findMany, count },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new DebatesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listSessions('student-1', 'debate-1', 1, 20);

    expect(findMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', debateId: 'debate-1' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({
      items: sessions,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
