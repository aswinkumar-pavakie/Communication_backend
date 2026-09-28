import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../config/configuration.js';
import { MockSpeechToTextProvider } from './providers/mock-speech-to-text.provider.js';
import {
  SpeechToTextProvider,
  TranscribeOptions,
  TranscriptionResult,
} from './stt.interface.js';

/**
 * Provider-agnostic entry point business logic should depend on. Never import a concrete
 * provider (e.g. MockSpeechToTextProvider) outside this file - swap providers by changing
 * STT_PROVIDER/AI_MODE, not by editing call sites.
 */
@Injectable()
export class SpeechToTextService {
  private readonly providerName: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly mockProvider: MockSpeechToTextProvider,
  ) {
    const ai = this.configService.get('ai', { infer: true });
    this.providerName = ai.mode === 'mock' ? 'mock' : ai.stt.provider;
  }

  async transcribe(
    audio: Buffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    return this.resolveProvider().transcribe(audio, options);
  }

  private resolveProvider(): SpeechToTextProvider {
    if (this.providerName === 'mock') {
      return this.mockProvider;
    }

    // IMPLEMENTED: mock provider. PLANNED: real provider adapters (Whisper, Deepgram, ...).
    throw new ServiceUnavailableException(
      `STT provider "${this.providerName}" is not implemented yet. Set STT_PROVIDER=mock or AI_MODE=mock for local development.`,
    );
  }
}
