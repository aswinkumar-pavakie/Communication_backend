import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [ProgressModule, RecommendationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
