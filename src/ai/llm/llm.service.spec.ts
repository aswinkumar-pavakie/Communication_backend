import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../config/configuration.js';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider.js';
import { LanguageModelService } from './llm.service.js';

function buildConfig(
  overrides: Partial<{ mode: string; provider: string }> = {},
) {
  return {
    get: jest.fn().mockReturnValue({
      mode: overrides.mode ?? 'mock',
      llm: { provider: overrides.provider ?? 'mock' },
    }),
  } as unknown as ConfigService<Configuration, true>;
}

describe('LanguageModelService', () => {
  it('delegates to the mock provider when AI_MODE=mock', async () => {
    const service = new LanguageModelService(
      buildConfig(),
      new MockLanguageModelProvider(),
    );

    const result = await service.generate({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.content.length).toBeGreaterThan(0);
  });

  it('throws a clear, controlled error for an unimplemented live provider', async () => {
    const service = new LanguageModelService(
      buildConfig({ mode: 'live', provider: 'openai' }),
      new MockLanguageModelProvider(),
    );

    await expect(
      service.generate({ systemPrompt: 'test', messages: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
