/**
 * Limits for roleplay/debate chats. Every turn resends history to the LLM, so without a cap
 * cost grows quadratically and a long session eventually overflows the model's context.
 */
/** Student replies allowed per session before they must finish and get feedback. */
export const MAX_STUDENT_TURNS_PER_SESSION = 20;
/** Most recent messages sent to the LLM when generating the next reply. */
export const LLM_HISTORY_WINDOW = 24;
/** Character budget for the transcript sent to the assessor at the end (newest replies kept). */
export const ASSESSMENT_TRANSCRIPT_MAX_CHARS = 12_000;

/** Keeps the newest student replies that fit the assessor's budget, oldest first. */
export function boundedTranscript(replies: string[]): string {
  const kept: string[] = [];
  let used = 0;
  for (let i = replies.length - 1; i >= 0; i--) {
    used += replies[i].length + 1;
    if (used > ASSESSMENT_TRANSCRIPT_MAX_CHARS && kept.length > 0) break;
    kept.unshift(replies[i]);
  }
  return kept.join('\n');
}
