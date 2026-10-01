import { Injectable } from '@nestjs/common';
import { SpeechSignalPronunciationProvider } from './providers/speech-signal-pronunciation.provider.js';
import {
  PronunciationAssessmentProvider,
  PronunciationAssessmentResult,
  PronunciationInput,
} from './pronunciation.interface.js';

/**
 * Scores pronunciation/delivery from the recording's transcription signals. Business logic
 * depends on this service only, so a phoneme-level provider (e.g. Azure Pronunciation
 * Assessment) can replace SpeechSignalPronunciationProvider without touching call sites.
 */
@Injectable()
export class PronunciationService {
  constructor(private readonly provider: SpeechSignalPronunciationProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  assess(input: PronunciationInput): PronunciationAssessmentResult | null {
    return (this.provider as PronunciationAssessmentProvider).assess(input);
  }
}
