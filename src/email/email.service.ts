import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends transactional email (password reset codes, streak reminders).
 * - EMAIL_PROVIDER=console (default): prints the email to the backend log - lets you test the
 *   whole forgot-password flow locally without any email account.
 * - EMAIL_PROVIDER=resend: sends through Resend's HTTPS API (RESEND_API_KEY + EMAIL_FROM).
 * Uses plain fetch, so no extra dependency is needed.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  /** True when real emails go out (vs. printed to the log). */
  get isLive(): boolean {
    const email = this.configService.get('email', { infer: true });
    return email.provider === 'resend' && Boolean(email.resendApiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const email = this.configService.get('email', { infer: true });

    if (email.provider !== 'resend' || !email.resendApiKey) {
      if (email.provider === 'resend') {
        this.logger.warn(
          'EMAIL_PROVIDER=resend but RESEND_API_KEY is empty - printing instead.',
        );
      }
      this.logger.log(
        `[email:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return;
    }

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Resend email failed: ${response.status} ${detail}`);
      throw new Error(`Email delivery failed with status ${response.status}.`);
    }
  }
}
