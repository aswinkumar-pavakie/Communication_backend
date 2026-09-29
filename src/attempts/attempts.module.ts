import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { AttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';

@Module({
  imports: [
    AiModule,
    AssessmentsModule,
    ProgressModule,
    RecommendationsModule,
    StreaksModule,
  ],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
