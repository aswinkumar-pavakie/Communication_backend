import { TranscriptionResult } from '../stt/stt.interface.js';

export interface PronunciationMetrics {
  /** 0-100: how confidently the speech recogniser understood the audio (intelligibility). */
  clarity: number;
  /** Words per minute while speaking; comfortable conversational pace is ~110-165. */
  wordsPerMinute: number;
  /** Silent gaps longer than LONG_PAUSE_SECONDS between words/segments. */
  longPauses: number;
  /** 0-100 word accuracy against the text the student was asked to read, when there is one. */
  referenceAccuracy: number | null;
  /** Seconds of actual speaking (first to last word). */
  speechSeconds: number;
}

export interface PronunciationAssessmentResult {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  metrics: PronunciationMetrics;
  /** How the score was produced, so the app/report can label it honestly. */
  method: 'speech-signal';
}

export interface PronunciationInput {
  transcription: TranscriptionResult;
  /** Exact text the student was asked to read aloud (read-aloud drills only). */
  referenceText?: string;
}

/**
 * Pronunciation needs the audio, not just the transcript. Providers work from what the
 * speech recogniser measured on the recording (per-segment confidence, silence probability,
 * word timings), which a text-only LLM assessment cannot see.
 */
export interface PronunciationAssessmentProvider {
  readonly name: string;
  /** Null when there isn't enough measurable speech to score fairly. */
  assess(input: PronunciationInput): PronunciationAssessmentResult | null;
}
