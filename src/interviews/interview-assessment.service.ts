import { Injectable } from '@nestjs/common';
import { Interview, InterviewQuestion } from '#prisma-client';
import { AssessmentContext } from '../ai/assessment/assessment.interface.js';
import { AssessmentService } from '../ai/assessment/assessment.service.js';

const INTERVIEW_SKILL_CODES = [
  'INTERVIEW',
  'TECHNICAL_COMMUNICATION',
  'CONFIDENCE',
];

@Injectable()
export class InterviewAssessmentService {
  constructor(private readonly assessmentService: AssessmentService) {}

  assessAnswer(
    interview: Pick<Interview, 'title'>,
    question: Pick<InterviewQuestion, 'questionText' | 'category'>,
    answerText: string,
  ) {
    return this.assessmentService.assess({
      context: AssessmentContext.INTERVIEW,
      content: answerText,
      activityTitle: interview.title,
      activityInstructions: `Question: ${question.questionText}${question.category ? ` (Category: ${question.category})` : ''}`,
      skillCodes: INTERVIEW_SKILL_CODES,
    });
  }
}
