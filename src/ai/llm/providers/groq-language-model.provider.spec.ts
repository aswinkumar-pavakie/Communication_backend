import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../../config/configuration.js';
import { GroqLanguageModelProvider } from './groq-language-model.provider.js';

function buildConfig(apiKey: string | undefined) {
  return {
    get: jest.fn().mockReturnValue({ llm: { apiKey } }),
  } as unknown as ConfigService<Configuration, true>;
}

describe('GroqLanguageModelProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws a controlled error when LLM_API_KEY is missing', async () => {
    const provider = new GroqLanguageModelProvider(buildConfig(undefined));

    await expect(
      provider.generate({ systemPrompt: 'test', messages: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sends the chat completion request and maps the response', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'a real reply' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    } as Response);
    globalThis.fetch = fetchMock;

    const provider = new GroqLanguageModelProvider(buildConfig('test-key'));
    const result = await provider.generate({
      systemPrompt: 'You are a coach.',
      messages: [{ role: 'user', content: 'hello' }],
      responseFormat: 'json',
    });

    expect(result.content).toBe('a real reply');
    expect(result.tokensUsed).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'You are a coach.',
    });
  });

  it('throws a controlled error when Groq responds with a non-2xx status', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as Response);

    const provider = new GroqLanguageModelProvider(buildConfig('test-key'));

    await expect(
      provider.generate({ systemPrompt: 'test', messages: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws a controlled error when the network request itself fails', async () => {
    globalThis.fetch = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'));

    const provider = new GroqLanguageModelProvider(buildConfig('test-key'));

    await expect(
      provider.generate({ systemPrompt: 'test', messages: [] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
