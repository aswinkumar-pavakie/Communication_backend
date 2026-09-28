import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { DebatesController } from './debates.controller.js';
import { DebatesService } from './debates.service.js';

@Module({
  imports: [AiModule, ProgressModule, RecommendationsModule],
  controllers: [DebatesController],
  providers: [DebatesService],
})
export class DebatesModule {}
