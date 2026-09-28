import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../config/configuration.js';
import {
  GenerateRequest,
  GenerateResult,
  LanguageModelProvider,
} from './llm.interface.js';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider.js';

@Injectable()
export class LanguageModelService {
  private readonly providerName: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly mockProvider: MockLanguageModelProvider,
  ) {
    const ai = this.configService.get('ai', { infer: true });
    this.providerName = ai.mode === 'mock' ? 'mock' : ai.llm.provider;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    return this.resolveProvider().generate(request);
  }

  private resolveProvider(): LanguageModelProvider {
    if (this.providerName === 'mock') {
      return this.mockProvider;
    }

    // IMPLEMENTED: mock provider. PLANNED: real provider adapters (OpenAI, Anthropic, ...).
    throw new ServiceUnavailableException(
      `LLM provider "${this.providerName}" is not implemented yet. Set LLM_PROVIDER=mock or AI_MODE=mock for local development.`,
    );
  }
}
