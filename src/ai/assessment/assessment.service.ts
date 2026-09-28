import { Injectable } from '@nestjs/common';
import { LanguageModelService } from '../llm/llm.service.js';
import {
  AssessmentContext,
  CommunicationAssessmentInput,
  CommunicationAssessmentProvider,
  CommunicationAssessmentResult,
} from './assessment.interface.js';
import { buildDebateAssessmentPrompt } from './prompts/debate-assessment.prompt.js';
import { buildGeneralSpeakingPrompt } from './prompts/communication-assessment.prompt.js';
import { buildInterviewAssessmentPrompt } from './prompts/interview-assessment.prompt.js';
import { buildRoleplayAssessmentPrompt } from './prompts/roleplay-assessment.prompt.js';
import { buildWritingAssessmentPrompt } from './prompts/writing-assessment.prompt.js';
import { ScoringService } from './scoring.service.js';

const PROMPT_BUILDERS: Record<
  AssessmentContext,
  (input: CommunicationAssessmentInput) => string
> = {
  [AssessmentContext.GENERAL_SPEAKING]: buildGeneralSpeakingPrompt,
  [AssessmentContext.INTERVIEW]: buildInterviewAssessmentPrompt,
  [AssessmentContext.WRITING]: buildWritingAssessmentPrompt,
  [AssessmentContext.ROLEPLAY]: buildRoleplayAssessmentPrompt,
  [AssessmentContext.DEBATE]: buildDebateAssessmentPrompt,
};

@Injectable()
export class AssessmentService implements CommunicationAssessmentProvider {
  constructor(
    private readonly llmService: LanguageModelService,
    private readonly scoringService: ScoringService,
  ) {}

  async assess(
    input: CommunicationAssessmentInput,
  ): Promise<CommunicationAssessmentResult> {
    const systemPrompt = PROMPT_BUILDERS[input.context](input);

    const result = await this.llmService.generate({
      systemPrompt,
      messages: [{ role: 'user', content: input.content }],
      responseFormat: 'json',
      temperature: 0.3,
      expectedSkillCodes: input.skillCodes,
    });

    const validated = await this.scoringService.parseAndValidate(
      result.content,
    );

    return {
      overallScore: validated.overallScore,
      feedback: validated.feedback,
      strengths: validated.strengths,
      weaknesses: validated.weaknesses,
      suggestedResponse: validated.suggestedResponse,
      skillScores: validated.skillScores,
    };
  }
}
