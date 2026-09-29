import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../../config/configuration.js';
import { GroqTextToSpeechProvider } from './groq-text-to-speech.provider.js';

function buildConfig(apiKey: string | undefined) {
  return {
    get: jest.fn().mockReturnValue({ tts: { apiKey } }),
  } as unknown as ConfigService<Configuration, true>;
}

describe('GroqTextToSpeechProvider', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws a controlled error when TTS_API_KEY is missing', async () => {
    const provider = new GroqTextToSpeechProvider(buildConfig(undefined));

    await expect(provider.synthesize('Hello.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sends the speech request and returns wav audio bytes', async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => audioBytes.buffer,
    } as Response);
    globalThis.fetch = fetchMock;

    const provider = new GroqTextToSpeechProvider(buildConfig('test-key'));
    const result = await provider.synthesize('Hello world.', {
      voice: 'hannah',
    });

    expect(result.format).toBe('wav');
    expect(result.audio).toEqual(Buffer.from(audioBytes));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/speech');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: 'canopylabs/orpheus-v1-english',
      input: 'Hello world.',
      voice: 'hannah',
      response_format: 'wav',
    });
  });

  it('defaults to the "austin" voice when none is requested', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);
    globalThis.fetch = fetchMock;

    const provider = new GroqTextToSpeechProvider(buildConfig('test-key'));
    await provider.synthesize('Hello.');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.voice).toBe('austin');
  });

  it('throws a controlled error when Groq responds with a non-2xx status', async () => {
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as Response);

    const provider = new GroqTextToSpeechProvider(buildConfig('test-key'));

    await expect(provider.synthesize('Hello.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
