export interface SynthesizeOptions {
  voice?: string;
  language?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface SynthesisResult {
  audio: Buffer;
  format: string;
  durationSeconds?: number;
}

export interface TextToSpeechProvider {
  readonly name: string;
  synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<SynthesisResult>;
}
