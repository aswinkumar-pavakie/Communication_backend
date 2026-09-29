import { jest } from '@jest/globals';
import { InterviewsService } from './interviews.service.js';

const question = (order: number) => ({
  id: `q${order}`,
  order,
  questionText: `Question ${order}`,
});

describe('InterviewsService.listAttempts', () => {
  function build(attempts: unknown[]) {
    const prisma = {
      interviewAttempt: {
        findMany: jest.fn(() => attempts),
        count: jest.fn(() => attempts.length),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    const questionService = {
      getFirstQuestion: jest.fn(async () => question(1)),
      getNextQuestion: jest.fn(async (_id: string, after: number) =>
        after < 3 ? question(after + 1) : null,
      ),
    };
    const service = new InterviewsService(
      prisma as never,
      questionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, questionService };
  }

  it('gives an untouched in-progress attempt the first question', async () => {
    const { service } = build([{ id: 'a1', status: 'STARTED', answers: [] }]);
    const result = await service.listAttempts('s1', 'i1', 1, 20);
    expect(result.items[0].nextQuestion).toEqual(question(1));
  });

  it('resumes after the highest answered question', async () => {
    const { service, questionService } = build([
      {
        id: 'a1',
        status: 'STARTED',
        answers: [{ question: question(1) }, { question: question(2) }],
      },
    ]);
    const result = await service.listAttempts('s1', 'i1', 1, 20);
    expect(questionService.getNextQuestion).toHaveBeenCalledWith('i1', 2);
    expect(result.items[0].nextQuestion).toEqual(question(3));
  });

  it('has no next question for completed attempts or fully answered ones', async () => {
    const { service, questionService } = build([
      { id: 'done', status: 'COMPLETED', answers: [{ question: question(1) }] },
      {
        id: 'full',
        status: 'STARTED',
        answers: [1, 2, 3].map((o) => ({ question: question(o) })),
      },
    ]);
    const result = await service.listAttempts('s1', 'i1', 1, 20);
    expect(result.items.map((i) => i.nextQuestion)).toEqual([null, null]);
    expect(questionService.getNextQuestion).toHaveBeenCalledTimes(1);
    expect(result.meta.total).toBe(2);
  });
});
