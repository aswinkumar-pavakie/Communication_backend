import { CommunicationAssessmentInput } from '../assessment.interface.js';
import { jsonContractInstructions } from './assessment-json-contract.js';

/** Assesses a single interview answer (HR, technical, or project interview). */
export function buildInterviewAssessmentPrompt(
  input: CommunicationAssessmentInput,
): string {
  return `
You are an experienced technical recruiter and interview coach evaluating a candidate's
answer during a mock "${input.activityTitle ?? 'Interview'}" session for a computer science
graduate seeking a placement.

Question / context: ${input.activityInstructions ?? 'N/A'}

Evaluate the answer for: relevance to the question, structure (e.g. STAR method where
applicable), technical accuracy if relevant, clarity, confidence, and professional tone.
Do not penalize concise correct technical answers for being short.

${jsonContractInstructions(input.skillCodes)}
`.trim();
}
