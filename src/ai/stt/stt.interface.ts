export interface TranscribeOptions {
  language?: string;
  /** Optional hint text to bias transcription (e.g. expected vocabulary). */
  prompt?: string;
}

export interface TranscriptionSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
  /** 0-1, from the recogniser's average token log-probability for this stretch of audio. */
  confidence?: number;
  /** 0-1 likelihood the segment is silence/noise rather than speech. */
  noSpeechProbability?: number;
}

export interface TranscriptionWord {
  word: string;
  startSeconds: number;
  endSeconds: number;
}

export interface TranscriptionResult {
  transcript: string;
  language?: string;
  durationSeconds?: number;
  confidence?: number;
  segments?: TranscriptionSegment[];
  /** Word-level timings, when the provider supports them (used for pace/pause analysis). */
  words?: TranscriptionWord[];
}

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(
    audio: Buffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult>;
}
