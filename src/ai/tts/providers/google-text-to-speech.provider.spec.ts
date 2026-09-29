import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Configuration } from '../../../config/configuration.js';
import { GoogleTextToSpeechProvider } from './google-text-to-speech.provider.js';

function buildConfig(googleCredentialsPath: string | undefined) {
  return {
    get: jest.fn().mockReturnValue({ tts: { googleCredentialsPath } }),
  } as unknown as ConfigService<Configuration, true>;
}

/** Bypasses the real `new TextToSpeechClient(...)` construction for a unit test. */
function withFakeClient(
  provider: GoogleTextToSpeechProvider,
  fakeClient: { synthesizeSpeech: jest.Mock },
) {
  (provider as unknown as { client: unknown }).client = fakeClient;
}

describe('GoogleTextToSpeechProvider', () => {
  it('throws a controlled error when GOOGLE_TTS_CREDENTIALS_PATH is missing', async () => {
    const provider = new GoogleTextToSpeechProvider(buildConfig(undefined));

    await expect(provider.synthesize('Hello world.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('synthesizes audio via the client and defaults to MP3', async () => {
    const provider = new GoogleTextToSpeechProvider(
      buildConfig('/fake/path/creds.json'),
    );
    const synthesizeSpeech = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue([{ audioContent: Buffer.from('mp3 bytes') }]);
    withFakeClient(provider, { synthesizeSpeech });

    const result = await provider.synthesize('Hello world.');

    expect(result.format).toBe('mp3');
    expect(result.audio).toEqual(Buffer.from('mp3 bytes'));
    expect(synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { text: 'Hello world.' },
        voice: expect.objectContaining({
          languageCode: 'en-US',
          name: 'en-US-Neural2-C',
        }),
        audioConfig: expect.objectContaining({ audioEncoding: 'MP3' }),
      }),
    );
  });

  it('maps format=wav to LINEAR16 audio encoding', async () => {
    const provider = new GoogleTextToSpeechProvider(
      buildConfig('/fake/path/creds.json'),
    );
    const synthesizeSpeech = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue([{ audioContent: Buffer.from('wav bytes') }]);
    withFakeClient(provider, { synthesizeSpeech });

    await provider.synthesize('Hello.', { format: 'wav' });

    expect(synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        audioConfig: expect.objectContaining({ audioEncoding: 'LINEAR16' }),
      }),
    );
  });

  it('throws a controlled error when the Google API call fails', async () => {
    const provider = new GoogleTextToSpeechProvider(
      buildConfig('/fake/path/creds.json'),
    );
    const synthesizeSpeech = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('quota exceeded'));
    withFakeClient(provider, { synthesizeSpeech });

    await expect(provider.synthesize('Hello.')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
