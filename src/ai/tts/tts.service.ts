import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../config/configuration.js';
import { MockTextToSpeechProvider } from './providers/mock-text-to-speech.provider.js';
import { GoogleTextToSpeechProvider } from './providers/google-text-to-speech.provider.js';
import { GroqTextToSpeechProvider } from './providers/groq-text-to-speech.provider.js';
import {
  SynthesisResult,
  SynthesizeOptions,
  TextToSpeechProvider,
} from './tts.interface.js';

@Injectable()
export class TextToSpeechService {
  readonly providerName: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly mockProvider: MockTextToSpeechProvider,
    private readonly googleProvider: GoogleTextToSpeechProvider,
    private readonly groqProvider: GroqTextToSpeechProvider,
  ) {
    const ai = this.configService.get('ai', { infer: true });
    this.providerName = ai.mode === 'mock' ? 'mock' : ai.tts.provider;
  }

  async synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    return this.resolveProvider().synthesize(text, options);
  }

  private resolveProvider(): TextToSpeechProvider {
    if (this.providerName === 'mock') {
      return this.mockProvider;
    }
    if (this.providerName === 'google') {
      return this.googleProvider;
    }
    if (this.providerName === 'groq') {
      return this.groqProvider;
    }

    // IMPLEMENTED: mock, google, groq. PLANNED: further provider adapters as needed.
    throw new ServiceUnavailableException(
      `TTS provider "${this.providerName}" is not implemented yet. Set TTS_PROVIDER=mock or AI_MODE=mock for local development.`,
    );
  }
}
