import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../config/configuration.js';
import { MockTextToSpeechProvider } from './providers/mock-text-to-speech.provider.js';
import { TextToSpeechService } from './tts.service.js';

function buildConfig(
  overrides: Partial<{ mode: string; provider: string }> = {},
) {
  return {
    get: jest.fn().mockReturnValue({
      mode: overrides.mode ?? 'mock',
      tts: { provider: overrides.provider ?? 'mock' },
    }),
  } as unknown as ConfigService<Configuration, true>;
}

function fakeProvider(name: string, audio: Buffer, format = 'mp3') {
  return {
    name,
    synthesize: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ audio, format }),
  };
}

describe('TextToSpeechService', () => {
  it('delegates to the mock provider when AI_MODE=mock', async () => {
    const service = new TextToSpeechService(
      buildConfig(),
      new MockTextToSpeechProvider(),
      fakeProvider('google', Buffer.from('unused')) as never,
      fakeProvider('groq', Buffer.from('unused')) as never,
    );
    const result = await service.synthesize('Hello world.');
    expect(result.audio.length).toBeGreaterThan(0);
  });

  it('delegates to the google provider when TTS_PROVIDER=google', async () => {
    const googleProvider = fakeProvider(
      'google',
      Buffer.from('real audio bytes'),
    );
    const service = new TextToSpeechService(
      buildConfig({ mode: 'live', provider: 'google' }),
      new MockTextToSpeechProvider(),
      googleProvider as never,
      fakeProvider('groq', Buffer.from('unused')) as never,
    );

    const result = await service.synthesize('Hello world.');
    expect(result.format).toBe('mp3');
    expect(googleProvider.synthesize).toHaveBeenCalledTimes(1);
  });

  it('delegates to the groq provider when TTS_PROVIDER=groq', async () => {
    const groqProvider = fakeProvider(
      'groq',
      Buffer.from('real audio bytes'),
      'wav',
    );
    const service = new TextToSpeechService(
      buildConfig({ mode: 'live', provider: 'groq' }),
      new MockTextToSpeechProvider(),
      fakeProvider('google', Buffer.from('unused')) as never,
      groqProvider as never,
    );

    const result = await service.synthesize('Hello world.');
    expect(result.format).toBe('wav');
    expect(groqProvider.synthesize).toHaveBeenCalledTimes(1);
  });

  it('throws a clear, controlled error for an unimplemented live provider', async () => {
    const service = new TextToSpeechService(
      buildConfig({ mode: 'live', provider: 'elevenlabs' }),
      new MockTextToSpeechProvider(),
      fakeProvider('google', Buffer.from('unused')) as never,
      fakeProvider('groq', Buffer.from('unused')) as never,
    );

    await expect(service.synthesize('Hello.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
