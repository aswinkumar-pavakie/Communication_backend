import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../config/configuration.js';
import {
  SynthesisResult,
  SynthesizeOptions,
  TextToSpeechProvider,
} from '../tts.interface.js';

const GROQ_SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech';
const GROQ_MODEL = 'canopylabs/orpheus-v1-english';
const DEFAULT_VOICE = 'austin';

/**
 * Real TTS provider backed by Groq's Orpheus model (canopylabs/orpheus-v1-english),
 * via the same Groq account/API key as GroqLanguageModelProvider and
 * GroqSpeechToTextProvider - no billing/service-account setup required, unlike
 * GoogleTextToSpeechProvider. Trade-off: a much tighter free-tier quota (100
 * requests/day) and a newer, less-proven model than Google's Neural2 voices.
 * Only "wav" output is confirmed supported by Groq's docs, so this provider always
 * requests wav regardless of the caller's requested format.
 */
@Injectable()
export class GroqTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqTextToSpeechProvider.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async synthesize(
    text: string,
    options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    const apiKey = this.configService.get('ai', { infer: true }).tts.apiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'TTS_PROVIDER=groq is set but TTS_API_KEY is missing. Add your Groq API key to .env.',
      );
    }

    let response: Response;
    try {
      response = await fetch(GROQ_SPEECH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          input: text,
          voice: options?.voice ?? DEFAULT_VOICE,
          response_format: 'wav',
        }),
      });
    } catch (err) {
      this.logger.error(`Groq TTS request failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Could not reach the Groq API for speech synthesis.',
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`Groq TTS failed: ${response.status} ${errorText}`);
      throw new ServiceUnavailableException(
        `Groq TTS request failed with status ${response.status}.`,
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());

    return { audio, format: 'wav' };
  }
}
