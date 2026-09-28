import { DebatePosition } from '#prisma-client';

function oppositePosition(position: DebatePosition): DebatePosition {
  return position === 'FOR' ? 'AGAINST' : 'FOR';
}

export function buildDebateSystemPrompt(
  topic: string,
  studentPosition: DebatePosition,
  description?: string | null,
): string {
  const aiPosition = oppositePosition(studentPosition);
  return `
You are debating the topic "${topic}" and must argue the "${aiPosition}" position, opposite
to the student who is arguing "${studentPosition}". This is a training exercise for a computer
science student practicing debate and critical-thinking skills for placements.

Topic context: ${description ?? 'N/A'}

Present strong, well-reasoned arguments with evidence or examples. Directly engage with and
challenge the student's points. Stay respectful and professional. Keep each reply to 2-4
sentences. Never break character or mention that you are an AI.
`.trim();
}
