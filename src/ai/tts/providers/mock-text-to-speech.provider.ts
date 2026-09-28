import { Injectable, Logger } from '@nestjs/common';
import {
  SynthesisResult,
  SynthesizeOptions,
  TextToSpeechProvider,
} from '../tts.interface.js';

const SAMPLE_RATE = 16_000;
const AVERAGE_WORDS_PER_MINUTE = 150;

function buildSilentWav(durationSeconds: number): Buffer {
  const numSamples = Math.max(1, Math.round(durationSeconds * SAMPLE_RATE));
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  // remaining bytes stay zero-initialized -> silence

  return buffer;
}

/**
 * Deterministic offline stand-in for a real TTS provider (ElevenLabs, Azure, Polly, etc).
 * Returns a valid, playable silent WAV sized to roughly match the spoken duration of the
 * input text, so downstream mobile playback code can be developed without a paid API.
 */
@Injectable()
export class MockTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockTextToSpeechProvider.name);

  synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds =
      Number(((wordCount / AVERAGE_WORDS_PER_MINUTE) * 60).toFixed(2)) || 0.5;

    this.logger.debug(
      `Mock synthesizing ${wordCount} words (~${durationSeconds}s of silent audio)`,
    );

    return Promise.resolve({
      audio: buildSilentWav(durationSeconds),
      format: options?.format ?? 'wav',
      durationSeconds,
    });
  }
}
