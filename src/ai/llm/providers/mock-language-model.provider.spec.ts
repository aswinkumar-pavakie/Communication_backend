import { MockLanguageModelProvider } from './mock-language-model.provider.js';

interface MockAssessmentJson {
  overallScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestedResponse: string;
  skillScores: { skillCode: string; score: number }[];
}

function parseAssessment(content: string): MockAssessmentJson {
  return JSON.parse(content) as MockAssessmentJson;
}

describe('MockLanguageModelProvider', () => {
  let provider: MockLanguageModelProvider;

  beforeEach(() => {
    provider = new MockLanguageModelProvider();
  });

  it('returns a conversational reply that references the last user message when no JSON is requested', async () => {
    const result = await provider.generate({
      systemPrompt: 'You are a coach.',
      messages: [
        { role: 'user', content: 'I want to practice my introduction.' },
      ],
    });

    expect(result.content).toContain('practice my introduction');
    expect(result.tokensUsed?.totalTokens).toBeGreaterThan(0);
  });

  it('returns valid JSON with a skillScores entry per expected skill code', async () => {
    const result = await provider.generate({
      systemPrompt: 'Assess this.',
      messages: [
        {
          role: 'user',
          content: 'This is a reasonably long answer with several words in it.',
        },
      ],
      responseFormat: 'json',
      expectedSkillCodes: ['INTERVIEW', 'TECHNICAL_COMMUNICATION'],
    });

    const parsed = parseAssessment(result.content);
    expect(parsed.skillScores).toHaveLength(2);
    expect(parsed.skillScores.map((s) => s.skillCode)).toEqual([
      'INTERVIEW',
      'TECHNICAL_COMMUNICATION',
    ]);
    expect(parsed.overallScore).toBeGreaterThanOrEqual(0);
    expect(parsed.overallScore).toBeLessThanOrEqual(100);
  });

  it('scores an empty transcript as zero across all requested skills', async () => {
    const result = await provider.generate({
      systemPrompt: 'Assess this.',
      messages: [{ role: 'user', content: '   ' }],
      responseFormat: 'json',
      expectedSkillCodes: ['GRAMMAR'],
    });

    const parsed = parseAssessment(result.content);
    expect(parsed.overallScore).toBe(0);
    expect(parsed.skillScores).toEqual([{ skillCode: 'GRAMMAR', score: 0 }]);
  });

  it('penalizes heavy filler-word usage in the fluency-related score', async () => {
    const clean = await provider.generate({
      systemPrompt: 'Assess this.',
      messages: [
        {
          role: 'user',
          content: 'I led the project and delivered the feature on schedule.',
        },
      ],
      responseFormat: 'json',
      expectedSkillCodes: ['FLUENCY'],
    });
    const filler = await provider.generate({
      systemPrompt: 'Assess this.',
      messages: [
        {
          role: 'user',
          content: 'um like I um basically um led the um project like um.',
        },
      ],
      responseFormat: 'json',
      expectedSkillCodes: ['FLUENCY'],
    });

    const cleanScore = parseAssessment(clean.content).skillScores[0].score;
    const fillerScore = parseAssessment(filler.content).skillScores[0].score;
    expect(fillerScore).toBeLessThan(cleanScore);
  });
});
