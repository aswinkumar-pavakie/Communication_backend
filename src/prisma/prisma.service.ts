import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
import { Configuration } from '../config/configuration.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService<Configuration, true>) {
    // Prisma 7 has no Rust query engine - all queries go through this driver
    // adapter, using the app's normal (pooled) DATABASE_URL. Migrations use
    // DIRECT_URL instead, via prisma.config.ts, since DDL doesn't play well
    // with a transaction pooler.
    const adapter = new PrismaPg({
      connectionString: configService.get('database', { infer: true }).url,
    });

    super({
      adapter,
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.$on('warn' as never, (event: unknown) =>
      this.logger.warn(JSON.stringify(event)),
    );
    this.$on('error' as never, (event: unknown) =>
      this.logger.error(JSON.stringify(event)),
    );
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
