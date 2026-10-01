import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';

const JWT_CONFIG = {
  accessSecret: 'access-secret',
  refreshSecret: 'refresh-secret',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
};

function buildConfigService() {
  return { get: jest.fn().mockReturnValue(JWT_CONFIG) } as never;
}

function buildJwtService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    signAsync: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue('signed.jwt.token'),
    decode: jest
      .fn()
      .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    verifyAsync: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'STUDENT',
      tokenId: 'token-1',
    }),
    ...overrides,
  } as never;
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates a new account and returns tokens when the email is not already taken', async () => {
      const usersService = {
        findByEmail: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
        createStudentUser: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          id: 'user-1',
          email: 'new@student.edu',
          role: 'STUDENT',
          studentProfile: {
            id: 'profile-1',
            firstName: 'A',
            lastName: 'B',
            department: null,
            year: null,
            batch: null,
          },
        }),
        findById: jest.fn(),
        findByIdWithProfile: jest.fn(),
      };
      const prisma = {
        refreshToken: {
          create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };

      const service = new AuthService(
        prisma as never,
        usersService as never,
        buildJwtService(),
        buildConfigService(),
      );

      const result = await service.register({
        email: 'New@Student.edu',
        password: 'StrongPass123!',
        firstName: 'A',
        lastName: 'B',
      });

      expect(usersService.createStudentUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@student.edu' }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('new@student.edu');
    });

    it('rejects registration when the email is already in use', async () => {
      const usersService = {
        findByEmail: jest
          .fn<() => Promise<unknown>>()
          .mockResolvedValue({ id: 'existing' }),
      };
      const service = new AuthService(
        {} as never,
        usersService as never,
        buildJwtService(),
        buildConfigService(),
      );

      await expect(
        service.register({
          email: 'dup@student.edu',
          password: 'x',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues tokens for correct credentials', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass123!', 10);
      const prisma = {
        user: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'user-1',
            email: 'student@edu.com',
            role: 'STUDENT',
            isActive: true,
            passwordHash,
            studentProfile: null,
          }),
        },
        refreshToken: {
          create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };

      const service = new AuthService(
        prisma as never,
        {} as never,
        buildJwtService(),
        buildConfigService(),
      );
      const result = await service.login({
        email: 'student@edu.com',
        password: 'CorrectPass123!',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass123!', 10);
      const prisma = {
        user: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'user-1',
            email: 'student@edu.com',
            role: 'STUDENT',
            isActive: true,
            passwordHash,
            studentProfile: null,
          }),
        },
      };

      const service = new AuthService(
        prisma as never,
        {} as never,
        buildJwtService(),
        buildConfigService(),
      );

      await expect(
        service.login({ email: 'student@edu.com', password: 'WrongPassword!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects login for a deactivated account', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'user-1',
            isActive: false,
            passwordHash: 'x',
          }),
        },
      };
      const service = new AuthService(
        prisma as never,
        {} as never,
        buildJwtService(),
        buildConfigService(),
      );

      await expect(
        service.login({ email: 'student@edu.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new token pair when valid', async () => {
      const storedHash = await bcrypt.hash('raw-refresh-token', 10);
      const prisma = {
        refreshToken: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: storedHash,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 100_000),
          }),
          updateMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ count: 1 }),
          create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
        },
      };
      const usersService = {
        findById: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          id: 'user-1',
          isActive: true,
          email: 'a@b.com',
          role: 'STUDENT',
        }),
      };

      const service = new AuthService(
        prisma as never,
        usersService as never,
        buildJwtService(),
        buildConfigService(),
      );
      const result = await service.refresh('raw-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'token-1', revokedAt: null } }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects the second of two concurrent refreshes with the same token', async () => {
      const storedHash = await bcrypt.hash('raw-refresh-token', 10);
      const prisma = {
        refreshToken: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: storedHash,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 100_000),
          }),
          // The other request already revoked it between our read and our claim.
          updateMany: jest
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ count: 0 }),
        },
      };
      const usersService = {
        findById: jest.fn<() => Promise<unknown>>().mockResolvedValue({
          id: 'user-1',
          isActive: true,
        }),
      };
      const service = new AuthService(
        prisma as never,
        usersService as never,
        buildJwtService(),
        buildConfigService(),
      );

      await expect(service.refresh('raw-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token that has already been revoked', async () => {
      const storedHash = await bcrypt.hash('raw-refresh-token', 10);
      const prisma = {
        refreshToken: {
          findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: storedHash,
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 100_000),
          }),
        },
      };

      const service = new AuthService(
        prisma as never,
        {} as never,
        buildJwtService(),
        buildConfigService(),
      );

      await expect(service.refresh('raw-refresh-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the JWT signature itself is invalid', async () => {
      const jwtService = buildJwtService({
        verifyAsync: jest
          .fn<() => Promise<unknown>>()
          .mockRejectedValue(new Error('bad signature')),
      });
      const service = new AuthService(
        {} as never,
        {} as never,
        jwtService,
        buildConfigService(),
      );

      await expect(service.refresh('tampered-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
