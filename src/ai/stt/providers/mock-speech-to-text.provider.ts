import { Injectable, Logger } from '@nestjs/common';
import {
  SpeechToTextProvider,
  TranscribeOptions,
  TranscriptionResult,
} from '../stt.interface.js';

/**
 * Deterministic offline stand-in for a real STT provider (Whisper, Deepgram, etc).
 * It does not analyze the audio content - it only estimates duration from buffer size
 * (assuming 16kHz/16-bit mono PCM) and returns a canned transcript so the rest of the
 * pipeline (assessment, scoring, progress) can be developed and tested without a paid API.
 */
@Injectable()
export class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockSpeechToTextProvider.name);

  transcribe(
    audio: Buffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    this.logger.debug(`Mock transcribing ${audio.length} bytes of audio`);

    const assumedByteRate = 16_000 * 2; // 16kHz, 16-bit mono
    const durationSeconds =
      audio.length > 0
        ? Number((audio.length / assumedByteRate).toFixed(2))
        : 0;

    const transcript =
      audio.length === 0
        ? ''
        : (options?.prompt ??
          'This is a mock transcript generated for local development. Configure a real STT provider to transcribe actual speech.');

    return Promise.resolve({
      transcript,
      language: options?.language ?? 'en',
      durationSeconds,
      confidence: 0.92,
      segments: transcript
        ? [
            {
              text: transcript,
              startSeconds: 0,
              endSeconds: durationSeconds,
              confidence: 0.92,
            },
          ]
        : [],
    });
  }
}
