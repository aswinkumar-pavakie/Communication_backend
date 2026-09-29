import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { Configuration } from '../../../config/configuration.js';
import {
  SynthesisResult,
  SynthesizeOptions,
  TextToSpeechProvider,
} from '../tts.interface.js';

const DEFAULT_LANGUAGE_CODE = 'en-US';
const DEFAULT_VOICE_NAME = 'en-US-Neural2-C';

const AUDIO_ENCODING_BY_FORMAT: Record<
  NonNullable<SynthesizeOptions['format']>,
  'MP3' | 'LINEAR16' | 'OGG_OPUS'
> = {
  mp3: 'MP3',
  wav: 'LINEAR16',
  ogg: 'OGG_OPUS',
};

/**
 * Real TTS provider backed by Google Cloud Text-to-Speech's Neural2 voices, via the
 * official client library (auth is a service-account JSON key, not a flat API key -
 * Cloud TTS's REST API only accepts OAuth2/service-account credentials). Defaults to
 * MP3 (compact for base64-over-JSON transport) unless the caller asks for wav/ogg.
 */
@Injectable()
export class GoogleTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleTextToSpeechProvider.name);
  private client: TextToSpeechClient | undefined;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    const client = this.getClientOrThrow();
    const format = options?.format ?? 'mp3';

    let response;
    try {
      [response] = await client.synthesizeSpeech({
        input: { text },
        voice: {
          languageCode: options?.language ?? DEFAULT_LANGUAGE_CODE,
          name: options?.voice ?? DEFAULT_VOICE_NAME,
        },
        audioConfig: {
          audioEncoding: AUDIO_ENCODING_BY_FORMAT[format],
          speakingRate: options?.speed,
        },
      });
    } catch (err) {
      this.logger.error(`Google TTS synthesis failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Google Cloud Text-to-Speech request failed.',
      );
    }

    if (!response.audioContent) {
      throw new ServiceUnavailableException(
        'Google Cloud Text-to-Speech returned no audio content.',
      );
    }

    return {
      audio: Buffer.from(response.audioContent),
      format,
    };
  }

  private getClientOrThrow(): TextToSpeechClient {
    if (this.client) return this.client;

    const credentialsPath = this.configService.get('ai', { infer: true }).tts
      .googleCredentialsPath;
    if (!credentialsPath) {
      throw new ServiceUnavailableException(
        'TTS_PROVIDER=google is set but GOOGLE_TTS_CREDENTIALS_PATH is missing. ' +
          'Set it to the path of your Google Cloud service-account JSON key.',
      );
    }

    this.client = new TextToSpeechClient({ keyFilename: credentialsPath });
    return this.client;
  }
}
