import { CommunicationAssessmentInput } from '../assessment.interface.js';
import { jsonContractInstructions } from './assessment-json-contract.js';

/** Assesses a student's argument(s) in a debate session. */
export function buildDebateAssessmentPrompt(
  input: CommunicationAssessmentInput,
): string {
  return `
You are a debate coach evaluating a student's argument(s) on the topic
"${input.activityTitle ?? 'Debate Topic'}".

Debate context: ${input.activityInstructions ?? 'N/A'}

Evaluate argument structure (claim, evidence, reasoning), relevance to the topic, clarity,
use of evidence, professional tone, and critical thinking. Note any logical fallacies.

${jsonContractInstructions(input.skillCodes)}
`.trim();
}
