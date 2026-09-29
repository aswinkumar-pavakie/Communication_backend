import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { WritingController } from './writing.controller.js';
import { WritingService } from './writing.service.js';

@Module({
  imports: [AiModule, ProgressModule, RecommendationsModule, StreaksModule],
  controllers: [WritingController],
  providers: [WritingService],
})
export class WritingModule {}
