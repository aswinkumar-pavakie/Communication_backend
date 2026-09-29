import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [ProgressModule, RecommendationsModule, StreaksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
