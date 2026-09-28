import { Injectable } from '@nestjs/common';
import {
  PronunciationAssessmentProvider,
  PronunciationAssessmentResult,
} from '../pronunciation.interface.js';

/**
 * MOCKED: this provider does NOT perform real pronunciation analysis. It cannot - that
 * requires audio/phoneme-level speech analysis. It returns a fixed, clearly-labeled
 * placeholder score so the assessment pipeline and database schema can be exercised end
 * to end before a real speech-analysis API (e.g. Azure Pronunciation Assessment) is wired in.
 */
@Injectable()
export class MockPronunciationProvider implements PronunciationAssessmentProvider {
  readonly name = 'mock';

  assess(audio: Buffer): Promise<PronunciationAssessmentResult> {
    return Promise.resolve({
      score: audio.length > 0 ? 70 : 0,
      feedback:
        'Pronunciation scoring is mocked in this environment - it is a fixed placeholder, ' +
        'not a real analysis of your speech. Connect a real pronunciation-assessment provider for accurate feedback.',
      details: { mocked: true },
    });
  }
}
