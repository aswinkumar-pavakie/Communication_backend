import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../../config/configuration.js';
import { GroqSpeechToTextProvider } from './groq-speech-to-text.provider.js';

function buildConfig(apiKey: string | undefined) {
  return {
    get: jest.fn().mockReturnValue({ stt: { apiKey } }),
  } as unknown as ConfigService<Configuration, true>;
}

describe('GroqSpeechToTextProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws a controlled error when STT_API_KEY is missing', async () => {
    const provider = new GroqSpeechToTextProvider(buildConfig(undefined));

    await expect(provider.transcribe(Buffer.alloc(10))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sends a multipart transcription request and maps the response', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'a real transcript',
        language: 'en',
        duration: 3.2,
        segments: [
          { text: 'a real transcript', start: 0, end: 3.2, avg_logprob: -0.1 },
        ],
      }),
    } as Response);
    globalThis.fetch = fetchMock;

    const provider = new GroqSpeechToTextProvider(buildConfig('test-key'));
    const result = await provider.transcribe(Buffer.alloc(16_000 * 2), {
      language: 'en',
    });

    expect(result.transcript).toBe('a real transcript');
    expect(result.durationSeconds).toBe(3.2);
    expect(result.segments?.[0]).toMatchObject({
      text: 'a real transcript',
      startSeconds: 0,
      endSeconds: 3.2,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('language')).toBe('en');
  });

  it('throws a controlled error when Groq responds with a non-2xx status', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response);

    const provider = new GroqSpeechToTextProvider(buildConfig('test-key'));

    await expect(provider.transcribe(Buffer.alloc(10))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
