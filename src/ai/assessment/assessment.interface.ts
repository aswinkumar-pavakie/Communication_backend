export enum AssessmentContext {
  GENERAL_SPEAKING = 'GENERAL_SPEAKING',
  INTERVIEW = 'INTERVIEW',
  WRITING = 'WRITING',
  ROLEPLAY = 'ROLEPLAY',
  DEBATE = 'DEBATE',
}

export interface CommunicationAssessmentInput {
  context: AssessmentContext;
  /** The student's transcript, answer text, or written submission to evaluate. */
  content: string;
  activityTitle?: string;
  activityInstructions?: string;
  /** Skill codes (from the Skill catalog) this assessment should score against. */
  skillCodes: string[];
}

export interface SkillScoreResult {
  skillCode: string;
  score: number;
}

export interface CommunicationAssessmentResult {
  overallScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestedResponse?: string;
  skillScores: SkillScoreResult[];
}

export interface CommunicationAssessmentProvider {
  assess(
    input: CommunicationAssessmentInput,
  ): Promise<CommunicationAssessmentResult>;
}
