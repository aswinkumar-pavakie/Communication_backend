import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { InterviewAssessmentService } from './interview-assessment.service.js';
import { InterviewQuestionService } from './interview-question.service.js';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsService } from './interviews.service.js';

@Module({
  imports: [AiModule, ProgressModule, RecommendationsModule, StreaksModule],
  controllers: [InterviewsController],
  providers: [
    InterviewsService,
    InterviewQuestionService,
    InterviewAssessmentService,
  ],
})
export class InterviewsModule {}
