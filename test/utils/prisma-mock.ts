import { jest } from '@jest/globals';

/** A jest.fn() typed to resolve/reject, since a bare `jest.Mock` defaults to a
 * non-Promise-returning signature and rejects `.mockResolvedValue(...)` entirely. */
type AsyncMock = jest.Mock<(...args: never[]) => Promise<unknown>>;

/**
 * A generic stand-in for PrismaService used by e2e tests. Every model delegate
 * (prisma.user, prisma.activity, ...) exposes the standard Prisma Client methods as
 * jest.fn()s with sensible empty defaults, so the full AppModule can boot without a real
 * database. Individual tests override the specific calls they care about with
 * `.mockResolvedValueOnce(...)` / `.mockImplementation(...)`.
 */
const MODEL_METHODS = [
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
] as const;

function createModelMock() {
  const model: Record<string, AsyncMock> = {};
  for (const method of MODEL_METHODS) {
    const defaultValue =
      method === 'count' ? 0 : method === 'findMany' ? [] : null;
    model[method] = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue(defaultValue);
  }
  return model;
}

export type PrismaMock = Record<string, ReturnType<typeof createModelMock>> & {
  $transaction: jest.Mock;
  $queryRaw: AsyncMock;
  $queryRawUnsafe: AsyncMock;
  $connect: AsyncMock;
  $disconnect: AsyncMock;
  $on: jest.Mock;
};

const MODEL_NAMES = [
  'user',
  'refreshToken',
  'studentProfile',
  'skill',
  'activity',
  'activityAttempt',
  'assessment',
  'assessmentScore',
  'progress',
  'recommendation',
  'interview',
  'interviewQuestion',
  'interviewAttempt',
  'interviewAnswer',
  'roleplay',
  'roleplaySession',
  'roleplayMessage',
  'debate',
  'debateSession',
  'debateMessage',
  'writingActivity',
  'writingSubmission',
  'report',
  'conversation',
  'conversationMessage',
  'voiceSession',
  'aiUsageLog',
];

export function createPrismaMock(): PrismaMock {
  const mock = {} as PrismaMock;

  for (const name of MODEL_NAMES) {
    mock[name] = createModelMock();
  }

  mock.$connect = jest
    .fn<() => Promise<unknown>>()
    .mockResolvedValue(undefined);
  mock.$disconnect = jest
    .fn<() => Promise<unknown>>()
    .mockResolvedValue(undefined);
  mock.$on = jest.fn();
  mock.$queryRaw = jest
    .fn<() => Promise<unknown>>()
    .mockResolvedValue([{ '?column?': 1 }]);
  mock.$queryRawUnsafe = jest
    .fn<() => Promise<unknown>>()
    .mockResolvedValue([{ '?column?': 1 }]);
  mock.$transaction = jest.fn(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === 'function') {
      return (arg as (tx: PrismaMock) => unknown)(mock);
    }
    return arg;
  });

  return mock;
}
