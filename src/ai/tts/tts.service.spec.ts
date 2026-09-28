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

describe('TextToSpeechService', () => {
  it('delegates to the mock provider when AI_MODE=mock', async () => {
    const service = new TextToSpeechService(
      buildConfig(),
      new MockTextToSpeechProvider(),
    );
    const result = await service.synthesize('Hello world.');
    expect(result.audio.length).toBeGreaterThan(0);
  });

  it('throws a clear, controlled error for an unimplemented live provider', async () => {
    const service = new TextToSpeechService(
      buildConfig({ mode: 'live', provider: 'elevenlabs' }),
      new MockTextToSpeechProvider(),
    );

    await expect(service.synthesize('Hello.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
