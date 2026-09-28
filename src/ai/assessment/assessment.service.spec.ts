import { jest } from '@jest/globals';
import { AssessmentContext } from './assessment.interface.js';
import { AssessmentService } from './assessment.service.js';

describe('AssessmentService', () => {
  it('builds a context-specific prompt, calls the LLM with expectedSkillCodes, and returns the validated result', async () => {
    const llmService = {
      generate: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ content: '{"raw":"json"}' }),
    };
    const scoringService = {
      parseAndValidate: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        overallScore: 82,
        feedback: 'Great job.',
        strengths: ['Clear'],
        weaknesses: [],
        suggestedResponse: 'Try X',
        skillScores: [{ skillCode: 'INTERVIEW', score: 82 }],
      }),
    };

    const service = new AssessmentService(
      llmService as never,
      scoringService as never,
    );

    const result = await service.assess({
      context: AssessmentContext.INTERVIEW,
      content: 'My answer to the interview question.',
      activityTitle: 'HR Interview',
      skillCodes: ['INTERVIEW'],
    });

    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: 'json',
        expectedSkillCodes: ['INTERVIEW'],
        messages: [
          { role: 'user', content: 'My answer to the interview question.' },
        ],
      }),
    );
    expect(scoringService.parseAndValidate).toHaveBeenCalledWith(
      '{"raw":"json"}',
    );
    expect(result.overallScore).toBe(82);
    expect(result.skillScores).toEqual([{ skillCode: 'INTERVIEW', score: 82 }]);
  });

  it('selects a different prompt builder per assessment context without throwing', async () => {
    const llmService = {
      generate: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ content: '{}' }),
    };
    const scoringService = {
      parseAndValidate: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        overallScore: 50,
        feedback: '',
        strengths: [],
        weaknesses: [],
        skillScores: [],
      }),
    };
    const service = new AssessmentService(
      llmService as never,
      scoringService as never,
    );

    for (const context of Object.values(AssessmentContext)) {
      await expect(
        service.assess({ context, content: 'text', skillCodes: ['GRAMMAR'] }),
      ).resolves.toBeDefined();
    }
    expect(llmService.generate).toHaveBeenCalledTimes(
      Object.values(AssessmentContext).length,
    );
  });
});
