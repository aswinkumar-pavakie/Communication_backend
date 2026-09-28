import { UnprocessableEntityException } from '@nestjs/common';
import { ScoringService } from './scoring.service.js';

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(() => {
    service = new ScoringService();
  });

  const validPayload = {
    overallScore: 80,
    feedback: 'Well done.',
    strengths: ['Clear structure'],
    weaknesses: ['Minor grammar slips'],
    suggestedResponse: 'Try this instead...',
    skillScores: [{ skillCode: 'GRAMMAR', score: 75 }],
  };

  it('parses and validates well-formed JSON', async () => {
    const result = await service.parseAndValidate(JSON.stringify(validPayload));
    expect(result.overallScore).toBe(80);
    expect(result.skillScores).toHaveLength(1);
  });

  it('recovers JSON wrapped in a markdown code fence', async () => {
    const wrapped = '```json\n' + JSON.stringify(validPayload) + '\n```';
    const result = await service.parseAndValidate(wrapped);
    expect(result.overallScore).toBe(80);
  });

  it('rejects output that is not valid JSON at all', async () => {
    await expect(
      service.parseAndValidate('this is not json'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects JSON that does not match the required shape', async () => {
    const malformed = JSON.stringify({
      overallScore: 'not a number',
      feedback: 'x',
    });
    await expect(service.parseAndValidate(malformed)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects an out-of-range score', async () => {
    const malformed = JSON.stringify({ ...validPayload, overallScore: 150 });
    await expect(service.parseAndValidate(malformed)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
