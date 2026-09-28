export interface TranscribeOptions {
  language?: string;
  /** Optional hint text to bias transcription (e.g. expected vocabulary). */
  prompt?: string;
}

export interface TranscriptionSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
  confidence?: number;
}

export interface TranscriptionResult {
  transcript: string;
  language?: string;
  durationSeconds?: number;
  confidence?: number;
  segments?: TranscriptionSegment[];
}

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(
    audio: Buffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult>;
}
