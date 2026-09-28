import { Injectable } from '@nestjs/common';
import { MockPronunciationProvider } from './providers/mock-pronunciation.provider.js';
import {
  PronunciationAssessmentProvider,
  PronunciationAssessmentResult,
} from './pronunciation.interface.js';

/**
 * IMPLEMENTED: routing through a replaceable provider. MOCKED: the only provider wired up
 * today is MockPronunciationProvider - see its docstring for why this cannot be faked from
 * text alone. Swap the provider here once a real speech-analysis API is integrated.
 */
@Injectable()
export class PronunciationService {
  constructor(private readonly provider: MockPronunciationProvider) {}

  assess(
    audio: Buffer,
    transcript?: string,
  ): Promise<PronunciationAssessmentResult> {
    return (this.provider as PronunciationAssessmentProvider).assess(
      audio,
      transcript,
    );
  }
}
