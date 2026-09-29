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

function fakeGroqProvider(content: string) {
  return {
    name: 'groq',
    generate: jest.fn<() => Promise<unknown>>().mockResolvedValue({ content }),
  };
}

describe('LanguageModelService', () => {
  it('delegates to the mock provider when AI_MODE=mock', async () => {
    const service = new LanguageModelService(
      buildConfig(),
      new MockLanguageModelProvider(),
      fakeGroqProvider('unused') as never,
    );

    const result = await service.generate({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.content.length).toBeGreaterThan(0);
  });

  it('delegates to the groq provider when LLM_PROVIDER=groq', async () => {
    const groqProvider = fakeGroqProvider('a real reply');
    const service = new LanguageModelService(
      buildConfig({ mode: 'live', provider: 'groq' }),
      new MockLanguageModelProvider(),
      groqProvider as never,
    );

    const result = await service.generate({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.content).toBe('a real reply');
    expect(groqProvider.generate).toHaveBeenCalledTimes(1);
  });

  it('throws a clear, controlled error for an unimplemented live provider', async () => {
    const service = new LanguageModelService(
      buildConfig({ mode: 'live', provider: 'openai' }),
      new MockLanguageModelProvider(),
      fakeGroqProvider('unused') as never,
    );

    await expect(
      service.generate({ systemPrompt: 'test', messages: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
