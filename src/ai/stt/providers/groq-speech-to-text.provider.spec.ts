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

  it('requests word timings and maps words + silence probability', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: 'hi there',
        duration: 1,
        segments: [
          {
            text: 'hi there',
            start: 0,
            end: 1,
            avg_logprob: -0.2,
            no_speech_prob: 0.02,
          },
        ],
        words: [
          { word: 'hi', start: 0, end: 0.3 },
          { word: 'there', start: 0.4, end: 0.9 },
        ],
      }),
    } as Response);
    globalThis.fetch = fetchMock;

    const result = await new GroqSpeechToTextProvider(
      buildConfig('test-key'),
    ).transcribe(Buffer.alloc(10));

    const form = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.getAll('timestamp_granularities[]')).toEqual([
      'segment',
      'word',
    ]);
    expect(result.words).toEqual([
      { word: 'hi', startSeconds: 0, endSeconds: 0.3 },
      { word: 'there', startSeconds: 0.4, endSeconds: 0.9 },
    ]);
    expect(result.segments?.[0].noSpeechProbability).toBe(0.02);
  });

  it('retries without word timings if the API rejects them', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'bad',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'fallback transcript' }),
      } as Response);
    globalThis.fetch = fetchMock;

    const result = await new GroqSpeechToTextProvider(
      buildConfig('test-key'),
    ).transcribe(Buffer.alloc(10));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryForm = (fetchMock.mock.calls[1][1] as RequestInit)
      .body as FormData;
    expect(retryForm.getAll('timestamp_granularities[]')).toEqual([]);
    expect(result.transcript).toBe('fallback transcript');
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
