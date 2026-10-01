import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { PasswordService } from './password.service.js';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        id: 'u1',
        email: 'asha@college.edu',
        isActive: true,
        passwordHash: bcrypt.hashSync('OldPass123!', 4),
        studentProfile: { firstName: 'Asha' },
      }),
      update: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    },
    passwordResetCode: {
      findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
      updateMany: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ count: 1 }),
      create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
      update: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    },
    refreshToken: {
      updateMany: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ count: 2 }),
    },
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    ),
    ...overrides,
  };
  const email = { send: jest.fn<() => Promise<void>>().mockResolvedValue() };
  const auth = {
    issueTokensFor: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  };
  const service = new PasswordService(
    prisma as never,
    email as never,
    auth as never,
  );
  return { service, prisma, email, auth };
}

describe('PasswordService', () => {
  it('emails a 6-digit code and stores only its hash', async () => {
    const { service, prisma, email } = build();
    await service.requestReset('Asha@College.edu');

    const sent = email.send.mock.calls[0] as unknown as [
      { to: string; subject: string },
    ];
    const code = /(\d{6})/.exec(sent[0].subject)?.[1];
    expect(sent[0].to).toBe('asha@college.edu');
    expect(code).toMatch(/^\d{6}$/);
    const stored = (
      prisma.passwordResetCode.create.mock.calls[0] as unknown as [
        { data: { codeHash: string } },
      ]
    )[0].data;
    expect(stored.codeHash).not.toContain(code);
    expect(await bcrypt.compare(code!, stored.codeHash)).toBe(true);
  });

  it('responds the same for unknown emails without sending anything', async () => {
    const { service, prisma, email } = build();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.requestReset('nobody@x.com')).resolves.toBeUndefined();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('resets the password with a valid code and signs out every device', async () => {
    const { service, prisma } = build();
    prisma.passwordResetCode.findFirst.mockResolvedValueOnce({
      id: 'c1',
      attempts: 0,
      codeHash: bcrypt.hashSync('123456', 4),
    });

    await service.resetPassword('asha@college.edu', '123456', 'NewPass123!');

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });

  it('counts wrong codes and rejects them', async () => {
    const { service, prisma } = build();
    prisma.passwordResetCode.findFirst.mockResolvedValueOnce({
      id: 'c1',
      attempts: 1,
      codeHash: bcrypt.hashSync('123456', 4),
    });

    await expect(
      service.resetPassword('asha@college.edu', '000000', 'NewPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.passwordResetCode.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('locks a code after too many wrong tries', async () => {
    const { service, prisma } = build();
    prisma.passwordResetCode.findFirst.mockResolvedValueOnce({
      id: 'c1',
      attempts: 5,
      codeHash: bcrypt.hashSync('123456', 4),
    });
    await expect(
      service.resetPassword('asha@college.edu', '123456', 'NewPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes the password only with the correct current one and returns fresh tokens', async () => {
    const { service, auth } = build();
    await expect(
      service.changePassword('u1', 'wrong', 'NewPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changePassword('u1', 'OldPass123!', 'NewPass123!'),
    ).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect(auth.issueTokensFor).toHaveBeenCalledTimes(1);
  });
});
