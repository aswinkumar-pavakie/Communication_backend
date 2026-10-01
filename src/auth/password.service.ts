import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { AuthTokensDto } from './dto/auth-response.dto.js';

const CODE_TTL_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
/** Don't let one address be flooded with codes. */
const MIN_SECONDS_BETWEEN_CODES = 60;
/** Same cost as AuthService uses for passwords; short-lived codes can be cheaper. */
const PASSWORD_SALT_ROUNDS = 12;
const CODE_SALT_ROUNDS = 10;
const INVALID_CODE = 'That code is invalid or has expired. Request a new one.';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Emails a 6-digit reset code. Always resolves the same way whether or not the address
   * has an account, so the endpoint can't be used to discover who is registered.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: { select: { firstName: true } } },
    });
    if (!user || !user.isActive) return;

    const recent = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(Date.now() - MIN_SECONDS_BETWEEN_CODES * 1000),
        },
      },
    });
    if (recent) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction([
      // Only the newest code works.
      this.prisma.passwordResetCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash: await bcrypt.hash(code, CODE_SALT_ROUNDS),
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    const name = user.studentProfile?.firstName ?? 'there';
    try {
      await this.emailService.send({
        to: user.email,
        subject: `Your password reset code: ${code}`,
        text:
          `Hi ${name},\n\nYour Communication Assistant password reset code is ${code}.\n` +
          `It expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.`,
        html:
          `<p>Hi ${name},</p><p>Your Communication Assistant password reset code is</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
          `<p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.</p>`,
      });
    } catch (err) {
      // Still respond normally (no account enumeration); the student can request again.
      this.logger.error(`Could not email reset code: ${String(err)}`);
    }
  }

  /** Checks the code, sets the new password and signs out every device. */
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.isActive) throw new BadRequestException(INVALID_CODE);

    const pending = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending || pending.attempts >= MAX_CODE_ATTEMPTS)
      throw new BadRequestException(INVALID_CODE);

    if (!(await bcrypt.compare(code, pending.codeHash))) {
      await this.prisma.passwordResetCode.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(INVALID_CODE);
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      // Single-use even if two requests race with the same code.
      const claimed = await tx.passwordResetCode.updateMany({
        where: { id: pending.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException(INVALID_CODE);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Signed-in password change. Other devices are signed out; this one gets fresh tokens so
   * the student stays logged in here.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthTokensDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Account is no longer active.');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Choose a new password that is different from your current one.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.authService.issueTokensFor(user);
  }
}
