import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service.js';

@Module({
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
