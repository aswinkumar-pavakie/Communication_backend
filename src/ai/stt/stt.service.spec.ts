import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../config/configuration.js';
import { MockSpeechToTextProvider } from './providers/mock-speech-to-text.provider.js';
import { SpeechToTextService } from './stt.service.js';

function buildConfig(
  overrides: Partial<{ mode: string; provider: string }> = {},
) {
  return {
    get: jest.fn().mockReturnValue({
      mode: overrides.mode ?? 'mock',
      stt: { provider: overrides.provider ?? 'mock' },
    }),
  } as unknown as ConfigService<Configuration, true>;
}

function fakeGroqProvider(transcript: string) {
  return {
    name: 'groq',
    transcribe: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ transcript }),
  };
}

describe('SpeechToTextService', () => {
  it('delegates to the mock provider when AI_MODE=mock', async () => {
    const mockProvider = new MockSpeechToTextProvider();
    const service = new SpeechToTextService(
      buildConfig({ mode: 'mock' }),
      mockProvider,
      fakeGroqProvider('unused') as never,
    );

    const result = await service.transcribe(Buffer.alloc(16_000 * 2));
    expect(result.transcript.length).toBeGreaterThan(0);
  });

  it('delegates to the groq provider when STT_PROVIDER=groq', async () => {
    const groqProvider = fakeGroqProvider('a real transcript');
    const service = new SpeechToTextService(
      buildConfig({ mode: 'live', provider: 'groq' }),
      new MockSpeechToTextProvider(),
      groqProvider as never,
    );

    const result = await service.transcribe(Buffer.alloc(10));
    expect(result.transcript).toBe('a real transcript');
    expect(groqProvider.transcribe).toHaveBeenCalledTimes(1);
  });

  it('throws a clear, controlled error for an unimplemented live provider', async () => {
    const mockProvider = new MockSpeechToTextProvider();
    const service = new SpeechToTextService(
      buildConfig({ mode: 'live', provider: 'whisper' }),
      mockProvider,
      fakeGroqProvider('unused') as never,
    );

    await expect(service.transcribe(Buffer.alloc(10))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
