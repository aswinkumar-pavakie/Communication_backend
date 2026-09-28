import { CommunicationAssessmentInput } from '../assessment.interface.js';
import { jsonContractInstructions } from './assessment-json-contract.js';

/**
 * General-purpose speaking assessment: self-introductions, project explanations,
 * professional communication, group discussion turns, and other free-form speaking activities.
 */
export function buildGeneralSpeakingPrompt(
  input: CommunicationAssessmentInput,
): string {
  return `
You are an expert English communication coach for engineering students preparing for
campus placements. Assess the student's spoken response below for a placement-training
activity titled "${input.activityTitle ?? 'Speaking Activity'}".

Activity instructions: ${input.activityInstructions ?? 'N/A'}

Evaluate clarity, grammar, vocabulary, fluency, confidence, and professional tone.
Be encouraging but honest. Do not fabricate praise the transcript does not support.

${jsonContractInstructions(input.skillCodes)}
`.trim();
}
