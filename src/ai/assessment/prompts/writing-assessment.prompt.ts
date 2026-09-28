import { CommunicationAssessmentInput } from '../assessment.interface.js';
import { jsonContractInstructions } from './assessment-json-contract.js';

/** Assesses a written submission: emails, requests, professional chat messages, etc. */
export function buildWritingAssessmentPrompt(
  input: CommunicationAssessmentInput,
): string {
  return `
You are a professional writing coach reviewing a student's written submission for the
activity "${input.activityTitle ?? 'Writing Activity'}".

Prompt given to the student: ${input.activityInstructions ?? 'N/A'}

Evaluate grammar, clarity, tone, professionalism, structure, and conciseness. Flag anything
that would be inappropriate or unclear in a real workplace email.

${jsonContractInstructions(input.skillCodes)}
`.trim();
}
