import { TranscriptionResult } from '../../stt/stt.interface.js';
import {
  paceScore,
  referenceAccuracy,
  SpeechSignalPronunciationProvider,
} from './speech-signal-pronunciation.provider.js';

/** Builds evenly spaced words at the given pace, with optional silent gaps (seconds) after word indexes. */
function speech(
  wordCount: number,
  wordsPerMinute: number,
  confidence: number,
  gaps: Record<number, number> = {},
): TranscriptionResult {
  const step = 60 / wordsPerMinute;
  const words = [];
  let t = 0;
  for (let i = 0; i < wordCount; i++) {
    words.push({ word: `w${i}`, startSeconds: t, endSeconds: t + step * 0.8 });
    t += step + (gaps[i] ?? 0);
  }
  return {
    transcript: words.map((w) => w.word).join(' '),
    durationSeconds: t,
    segments: [
      {
        text: '',
        startSeconds: 0,
        endSeconds: t,
        confidence,
        noSpeechProbability: 0.01,
      },
    ],
    words,
  };
}

describe('SpeechSignalPronunciationProvider', () => {
  const provider = new SpeechSignalPronunciationProvider();

  it('scores clear speech at a natural pace highly', () => {
    const result = provider.assess({ transcription: speech(40, 140, 0.88) });
    expect(result).not.toBeNull();
    expect(result!.metrics.clarity).toBe(100);
    expect(result!.metrics.longPauses).toBe(0);
    expect(result!.score).toBeGreaterThanOrEqual(95);
    expect(result!.strengths.length).toBeGreaterThan(0);
    expect(result!.method).toBe('speech-signal');
  });

  it('scores mumbled, slow, hesitant speech low and says why', () => {
    const result = provider.assess({
      transcription: speech(20, 70, 0.45, { 3: 2, 8: 2.5, 12: 3 }),
    });
    expect(result!.metrics.clarity).toBeLessThan(30);
    expect(result!.metrics.longPauses).toBe(3);
    expect(result!.score).toBeLessThan(45);
    expect(result!.improvements.join(' ')).toMatch(/hard to make out/);
    expect(result!.improvements.join(' ')).toMatch(/slow/);
  });

  it('returns null when there is too little speech to judge', () => {
    expect(provider.assess({ transcription: speech(2, 140, 0.9) })).toBeNull();
    expect(
      provider.assess({
        transcription: { transcript: 'hello there friend', segments: [] },
      }),
    ).toBeNull();
  });

  it('ignores segments the recogniser marks as silence', () => {
    const t = speech(30, 140, 0.9);
    t.segments!.push({
      text: '',
      startSeconds: 20,
      endSeconds: 40,
      confidence: 0.1,
      noSpeechProbability: 0.9,
    });
    expect(provider.assess({ transcription: t })!.metrics.clarity).toBe(100);
  });

  it('weighs reference accuracy for read-aloud drills', () => {
    const t = speech(8, 140, 0.9);
    t.transcript = 'the quick brown fox jumps over the dog';
    const result = provider.assess({
      transcription: t,
      referenceText: 'The quick brown fox jumps over the lazy dog.',
    });
    expect(result!.metrics.referenceAccuracy).toBe(89);
  });
});

describe('pronunciation helpers', () => {
  it('computes word accuracy with punctuation and case ignored', () => {
    expect(referenceAccuracy('Hello, World!', 'hello world')).toBe(100);
    expect(referenceAccuracy('one two three four', 'one three four')).toBe(75);
  });

  it('gives full pace marks only inside the comfortable range', () => {
    expect(paceScore(140)).toBe(100);
    expect(paceScore(80)).toBe(50);
    expect(paceScore(230)).toBe(0);
  });
});
