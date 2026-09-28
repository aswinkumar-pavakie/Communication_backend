import { Injectable, Logger } from '@nestjs/common';
import { AiServiceType } from '#prisma-client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface RecordUsageInput {
  studentId?: string;
  provider: string;
  service: AiServiceType;
  requestType: string;
  tokensUsed?: number;
  audioDurationSeconds?: number;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cost-observability only - this does NOT implement billing. It gives every AI call a
 * queryable record (who, which provider/service, how much) so usage can be measured and
 * capped later. Never let a logging failure break the caller's actual request.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordUsageInput): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          studentId: input.studentId,
          provider: input.provider,
          service: input.service,
          requestType: input.requestType,
          tokensUsed: input.tokensUsed,
          audioDurationSeconds: input.audioDurationSeconds,
          estimatedCostUsd: input.estimatedCostUsd,
          metadata: input.metadata as never,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record AI usage log: ${(error as Error).message}`,
      );
    }
  }
}
