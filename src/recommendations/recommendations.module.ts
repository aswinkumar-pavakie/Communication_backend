import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service.js';

@Module({
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
