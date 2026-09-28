/**
 * Shared JSON response contract appended to every assessment prompt. Keeping this in one
 * place means every prompt asks the LLM for exactly what LlmAssessmentResultDto validates.
 */
export function jsonContractInstructions(skillCodes: string[]): string {
  return `
Respond with ONLY valid JSON (no markdown code fences, no commentary) matching this exact shape:
{
  "overallScore": number (0-100),
  "feedback": string (2-4 sentences of constructive feedback),
  "strengths": string[] (0-5 short bullet points),
  "weaknesses": string[] (0-5 short bullet points),
  "suggestedResponse": string (a brief example of a stronger response),
  "skillScores": [ { "skillCode": string, "score": number (0-100) } ]
}
The "skillScores" array must contain exactly one entry for each of these skill codes: ${skillCodes.join(', ')}.
Do not include any keys other than the ones specified above.
`.trim();
}
