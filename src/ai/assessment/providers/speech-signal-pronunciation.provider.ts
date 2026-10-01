import { Injectable } from '@nestjs/common';
import {
  PronunciationAssessmentProvider,
  PronunciationAssessmentResult,
  PronunciationInput,
} from '../pronunciation.interface.js';

/** Fewer words than this and a score would be noise, not signal. */
const MIN_WORDS = 3;
const LONG_PAUSE_SECONDS = 1.2;
/** Segments the recogniser thinks are probably silence don't count toward clarity. */
const NO_SPEECH_CUTOFF = 0.6;
/** Recogniser confidence mapped onto 0-100: ~0.35 is barely intelligible, ~0.85+ is very clear. */
const CLARITY_FLOOR = 0.35;
const CLARITY_CEILING = 0.85;
const IDEAL_WPM_MIN = 110;
const IDEAL_WPM_MAX = 165;

const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, n));

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Word-level edit distance -> accuracy against the read-aloud text (1 - word error rate). */
export function referenceAccuracy(reference: string, spoken: string): number {
  const ref = normalizeWords(reference);
  const hyp = normalizeWords(spoken);
  if (ref.length === 0) return 0;
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const curr = [i];
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  const wordErrorRate = prev[hyp.length] / ref.length;
  return Math.round(clamp((1 - wordErrorRate) * 100));
}

export function paceScore(wpm: number): number {
  if (wpm >= IDEAL_WPM_MIN && wpm <= IDEAL_WPM_MAX) return 100;
  if (wpm < IDEAL_WPM_MIN)
    return clamp(((wpm - 50) / (IDEAL_WPM_MIN - 50)) * 100);
  return clamp(100 - ((wpm - IDEAL_WPM_MAX) / (230 - IDEAL_WPM_MAX)) * 100);
}

/**
 * Real, audio-derived pronunciation/delivery scoring built on what Whisper measures while
 * transcribing the recording:
 *  - clarity: duration-weighted recogniser confidence per speech segment (intelligibility),
 *  - pace: words per minute over the actual speaking time,
 *  - pauses: long silent gaps between words,
 *  - accuracy: word error rate against the reference text for read-aloud drills.
 * It measures how intelligibly and fluently the student spoke - not phoneme-level accent
 * analysis, which would need a dedicated pronunciation-assessment API.
 */
@Injectable()
export class SpeechSignalPronunciationProvider implements PronunciationAssessmentProvider {
  readonly name = 'speech-signal';

  assess({
    transcription,
    referenceText,
  }: PronunciationInput): PronunciationAssessmentResult | null {
    const segments = (transcription.segments ?? []).filter(
      (s) =>
        s.confidence !== undefined &&
        (s.noSpeechProbability ?? 0) < NO_SPEECH_CUTOFF,
    );
    const words = transcription.words?.length ? transcription.words : null;
    const wordCount =
      words?.length ?? normalizeWords(transcription.transcript).length;
    if (segments.length === 0 || wordCount < MIN_WORDS) return null;

    // Clarity: longer segments weigh more than a one-word blip.
    let weighted = 0;
    let totalWeight = 0;
    for (const s of segments) {
      const weight = Math.max(0.1, s.endSeconds - s.startSeconds);
      weighted += (s.confidence ?? 0) * weight;
      totalWeight += weight;
    }
    const meanConfidence = weighted / totalWeight;
    const clarity = Math.round(
      clamp(
        ((meanConfidence - CLARITY_FLOOR) / (CLARITY_CEILING - CLARITY_FLOOR)) *
          100,
      ),
    );

    // Speaking time and long pauses - word timings when available, else segment boundaries.
    const spans = words
      ? words.map((w) => [w.startSeconds, w.endSeconds] as const)
      : segments.map((s) => [s.startSeconds, s.endSeconds] as const);
    const speechSeconds = Math.max(1, spans[spans.length - 1][1] - spans[0][0]);
    let longPauses = 0;
    for (let i = 1; i < spans.length; i++) {
      if (spans[i][0] - spans[i - 1][1] > LONG_PAUSE_SECONDS) longPauses++;
    }
    const wordsPerMinute = Math.round(wordCount / (speechSeconds / 60));
    const pace = paceScore(wordsPerMinute);
    const pausesPerMinute = longPauses / (speechSeconds / 60);
    const pauseScore = clamp(100 - pausesPerMinute * 20);

    const accuracy = referenceText?.trim()
      ? referenceAccuracy(referenceText, transcription.transcript)
      : null;

    const score = Math.round(
      accuracy === null
        ? clarity * 0.55 + pace * 0.25 + pauseScore * 0.2
        : accuracy * 0.35 + clarity * 0.35 + pace * 0.15 + pauseScore * 0.15,
    );

    const strengths: string[] = [];
    const improvements: string[] = [];
    if (clarity >= 75)
      strengths.push(
        `Clear, easy-to-understand speech (clarity ${clarity}/100).`,
      );
    else if (clarity < 55)
      improvements.push(
        `Some words were hard to make out (clarity ${clarity}/100) - open your mouth wider and finish word endings.`,
      );
    if (pace === 100)
      strengths.push(
        `Comfortable speaking pace (${wordsPerMinute} words/min).`,
      );
    else if (wordsPerMinute < IDEAL_WPM_MIN)
      improvements.push(
        `A little slow (${wordsPerMinute} words/min) - aim for ${IDEAL_WPM_MIN}-${IDEAL_WPM_MAX}.`,
      );
    else
      improvements.push(
        `Quite fast (${wordsPerMinute} words/min) - slow to ${IDEAL_WPM_MIN}-${IDEAL_WPM_MAX} so every word lands.`,
      );
    if (longPauses === 0)
      strengths.push('Smooth delivery with no long pauses.');
    else if (pauseScore < 70)
      improvements.push(
        `${longPauses} long pause${longPauses === 1 ? '' : 's'} - plan your next point while you speak.`,
      );
    if (accuracy !== null) {
      if (accuracy >= 85)
        strengths.push(`Read the passage accurately (${accuracy}% of words).`);
      else
        improvements.push(
          `${100 - accuracy}% of the passage's words were missed or misheard - read it slowly once more.`,
        );
    }

    const feedback =
      score >= 75
        ? 'Your speech came through clearly and at a good pace.'
        : score >= 55
          ? 'Your speech was mostly clear - a few delivery habits are holding your score back.'
          : 'Your speech was hard to follow in places - focus on clarity and a steady pace.';

    return {
      score,
      feedback,
      strengths,
      improvements,
      metrics: {
        clarity,
        wordsPerMinute,
        longPauses,
        referenceAccuracy: accuracy,
        speechSeconds,
      },
      method: 'speech-signal',
    };
  }
}
