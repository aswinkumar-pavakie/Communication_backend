import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { AssessmentsModule } from './assessments/assessments.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js';
import configuration, { Configuration } from './config/configuration.js';
import { validationSchema } from './config/validation.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DebatesModule } from './debates/debates.module.js';
import { HealthModule } from './health/health.module.js';
import { InterviewsModule } from './interviews/interviews.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RoleplayModule } from './roleplay/roleplay.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StudentsModule } from './students/students.module.js';
import { UsersModule } from './users/users.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { WritingModule } from './writing/writing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => {
        const throttle = configService.get('throttle', { infer: true });
        return {
          throttlers: [
            {
              name: 'default',
              ttl: throttle.ttl * 1000,
              limit: throttle.limit,
            },
          ],
        };
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    SkillsModule,
    ActivitiesModule,
    AttemptsModule,
    AssessmentsModule,
    ProgressModule,
    RecommendationsModule,
    DashboardModule,
    InterviewsModule,
    RoleplayModule,
    DebatesModule,
    WritingModule,
    ReportsModule,
    StorageModule,
    AiModule,
    VoiceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
