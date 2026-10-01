import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { StudentProfile, User } from '#prisma-client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Configuration } from '../config/configuration.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import {
  JwtPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface.js';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const user = await this.usersService.createStudentUser({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      department: dto.department,
      year: dto.year,
      batch: dto.batch,
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toUserProfile(user, user.studentProfile) };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { studentProfile: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toUserProfile(user, user.studentProfile) };
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    // Atomic single-use claim: if two refreshes race with the same token, only one wins.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.verifyRefreshToken(refreshToken);
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.tokenId, userId },
          data: { revokedAt: new Date() },
        });
        return;
      } catch {
        // fall through to revoking all sessions if the provided token is unusable
      }
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthResponseDto['user']> {
    const user = await this.usersService.findByIdWithProfile(userId);
    if (!user) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    return this.toUserProfile(user, user.studentProfile);
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<JwtRefreshPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: this.configService.get('jwt', { infer: true }).refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  /** New token pair for a user - used after a password change so this device stays signed in. */
  issueTokensFor(user: User): Promise<AuthTokensDto> {
    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthTokensDto> {
    const jwtConfig = this.configService.get('jwt', { infer: true });

    // expiresIn is typed as the branded `ms` StringValue union upstream; env-var strings
    // like "15m"/"7d" (see .env.example) satisfy it at runtime but not statically.
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn,
    } as JwtSignOptions);

    const tokenId = randomUUID();
    const refreshPayload: JwtRefreshPayload = { ...accessPayload, tokenId };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshExpiresIn,
    } as JwtSignOptions);

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    const tokenHash = await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private toUserProfile(
    user: User,
    studentProfile: StudentProfile | null | undefined,
  ): AuthResponseDto['user'] {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      studentProfile: studentProfile
        ? {
            id: studentProfile.id,
            firstName: studentProfile.firstName,
            lastName: studentProfile.lastName,
            department: studentProfile.department,
            year: studentProfile.year,
            batch: studentProfile.batch,
          }
        : null,
    };
  }
}
