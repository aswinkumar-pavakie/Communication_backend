import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../config/configuration.js';
import {
  SpeechToTextProvider,
  TranscribeOptions,
  TranscriptionResult,
} from '../stt.interface.js';

const GROQ_TRANSCRIPTIONS_URL =
  'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3';

interface GroqTranscriptionSegment {
  text: string;
  start: number;
  end: number;
  avg_logprob?: number;
}

interface GroqVerboseTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: GroqTranscriptionSegment[];
}

/**
 * Real STT provider backed by Groq's OpenAI-compatible audio transcriptions API
 * (https://api.groq.com/openai/v1/audio/transcriptions, model whisper-large-v3 -
 * not the "turbo" variant, since whisper-large-v3 has the lower word-error-rate at the
 * same free-tier quota). Uses the same Groq account/API key as GroqLanguageModelProvider.
 */
@Injectable()
export class GroqSpeechToTextProvider implements SpeechToTextProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqSpeechToTextProvider.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async transcribe(
    audio: Buffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    const apiKey = this.configService.get('ai', { infer: true }).stt.apiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'STT_PROVIDER=groq is set but STT_API_KEY is missing. Add your Groq API key to .env.',
      );
    }

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
    form.append('model', GROQ_MODEL);
    form.append('response_format', 'verbose_json');
    if (options?.language) form.append('language', options.language);
    if (options?.prompt) form.append('prompt', options.prompt);

    let response: Response;
    try {
      response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (err) {
      this.logger.error(`Groq transcription request failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Could not reach the Groq API for audio transcription.',
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(
        `Groq transcription failed: ${response.status} ${errorText}`,
      );
      throw new ServiceUnavailableException(
        `Groq STT request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as GroqVerboseTranscriptionResponse;

    return {
      transcript: data.text ?? '',
      language: data.language,
      durationSeconds: data.duration,
      segments: data.segments?.map((segment) => ({
        text: segment.text,
        startSeconds: segment.start,
        endSeconds: segment.end,
        confidence:
          segment.avg_logprob !== undefined
            ? Math.exp(segment.avg_logprob)
            : undefined,
      })),
    };
  }
}
