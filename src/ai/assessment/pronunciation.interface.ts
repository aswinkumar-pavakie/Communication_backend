export interface PronunciationAssessmentResult {
  score: number;
  feedback: string;
  details?: Record<string, unknown>;
}

/**
 * Pronunciation cannot be reliably assessed from a text transcript alone - it requires
 * analysis of the actual audio waveform (phoneme timing, stress, intonation). This is
 * deliberately a separate capability from CommunicationAssessmentProvider so a real
 * speech-analysis API can be plugged in later without touching transcript-based scoring.
 */
export interface PronunciationAssessmentProvider {
  readonly name: string;
  assess(
    audio: Buffer,
    transcript?: string,
  ): Promise<PronunciationAssessmentResult>;
}
