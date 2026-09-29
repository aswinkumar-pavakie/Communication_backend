import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { RoleplayController } from './roleplay.controller.js';
import { RoleplayService } from './roleplay.service.js';

@Module({
  imports: [AiModule, ProgressModule, RecommendationsModule, StreaksModule],
  controllers: [RoleplayController],
  providers: [RoleplayService],
})
export class RoleplayModule {}
