import { CommunicationAssessmentInput } from '../assessment.interface.js';
import { jsonContractInstructions } from './assessment-json-contract.js';

/** Assesses a student's turn (or whole session transcript) in a workplace roleplay scenario. */
export function buildRoleplayAssessmentPrompt(
  input: CommunicationAssessmentInput,
): string {
  return `
You are a workplace communication coach reviewing a student's performance in a roleplay
scenario titled "${input.activityTitle ?? 'Roleplay'}".

Scenario context: ${input.activityInstructions ?? 'N/A'}

Evaluate how well the student handled the workplace situation: tone, empathy, assertiveness,
clarity, and professionalism. Consider whether their response would de-escalate or resolve
the situation in a real workplace.

${jsonContractInstructions(input.skillCodes)}
`.trim();
}
