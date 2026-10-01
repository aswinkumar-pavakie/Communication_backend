import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { PronunciationAssessmentResult } from '../ai/assessment/pronunciation.interface.js';
import {
  AttemptsService,
  readAloudText,
  withPronunciation,
} from './attempts.service.js';

const pronunciation: PronunciationAssessmentResult = {
  score: 90,
  feedback: 'Clear.',
  strengths: ['Clear, easy-to-understand speech.'],
  improvements: ['A little slow.'],
  metrics: {
    clarity: 95,
    wordsPerMinute: 105,
    longPauses: 0,
    referenceAccuracy: null,
    speechSeconds: 30,
  },
  method: 'speech-signal',
};

const textAssessment = {
  overallScore: 60,
  feedback: 'Good structure.',
  strengths: ['Well organised.'],
  weaknesses: ['Add an example.'],
  skillScores: [
    { skillCode: 'FLUENCY', score: 62 },
    { skillCode: 'PRONUNCIATION', score: 40 },
  ],
};

describe('withPronunciation', () => {
  it('replaces the text-based pronunciation guess with the measured score', () => {
    const merged = withPronunciation(textAssessment, pronunciation, 'SPEAKING');
    expect(merged.skillScores).toEqual([
      { skillCode: 'FLUENCY', score: 62 },
      { skillCode: 'PRONUNCIATION', score: 90 },
    ]);
    expect(merged.overallScore).toBe(60);
    expect(merged.strengths).toContain('Clear, easy-to-understand speech.');
    expect(merged.weaknesses).toContain('A little slow.');
  });

  it('lets the measured score drive the overall score for pronunciation drills', () => {
    expect(
      withPronunciation(textAssessment, pronunciation, 'PRONUNCIATION')
        .overallScore,
    ).toBe(81);
  });
});

describe('readAloudText', () => {
  it('extracts the quoted passage from pronunciation drill instructions', () => {
    expect(
      readAloudText({
        type: 'PRONUNCIATION',
        instructions:
          'Read this aloud: “Three thin thieves thought a thousand thoughts.”',
      }),
    ).toBe('Three thin thieves thought a thousand thoughts.');
  });

  it('ignores other activity types', () => {
    expect(
      readAloudText({
        type: 'SPEAKING',
        instructions: 'Say "hello to everyone here"',
      }),
    ).toBeUndefined();
  });
});

describe('AttemptsService.createTextAttempt', () => {
  it('refuses typed answers for pronunciation activities', async () => {
    const prisma = {
      activity: {
        findUnique: jest.fn(async () => ({
          id: 'a1',
          isActive: true,
          type: 'PRONUNCIATION',
        })),
      },
    };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.createTextAttempt('s1', 'a1', 'typed'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
