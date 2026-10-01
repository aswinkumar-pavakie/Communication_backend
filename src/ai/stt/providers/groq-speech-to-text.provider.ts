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
  no_speech_prob?: number;
}

interface GroqTranscriptionWord {
  word: string;
  start: number;
  end: number;
}

interface GroqVerboseTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: GroqTranscriptionSegment[];
  words?: GroqTranscriptionWord[];
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

    let response = await this.request(apiKey, audio, options, true);
    // Word timings power pace/pause analysis but aren't essential - if the API ever rejects
    // the granularity option, fall back to a plain segment-level transcription.
    if (response.status === 400) {
      this.logger.warn(
        'Groq rejected word timestamps; retrying without them (pace/pause analysis will use segments).',
      );
      response = await this.request(apiKey, audio, options, false);
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
        noSpeechProbability: segment.no_speech_prob,
      })),
      words: data.words?.map((w) => ({
        word: w.word,
        startSeconds: w.start,
        endSeconds: w.end,
      })),
    };
  }

  private async request(
    apiKey: string,
    audio: Buffer,
    options: TranscribeOptions | undefined,
    withWordTimestamps: boolean,
  ): Promise<Response> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)]), 'audio.wav');
    form.append('model', GROQ_MODEL);
    form.append('response_format', 'verbose_json');
    if (withWordTimestamps) {
      form.append('timestamp_granularities[]', 'segment');
      form.append('timestamp_granularities[]', 'word');
    }
    if (options?.language) form.append('language', options.language);
    if (options?.prompt) form.append('prompt', options.prompt);

    try {
      return await fetch(GROQ_TRANSCRIPTIONS_URL, {
        method: 'POST',
        // Never hang a student's request on a stuck upstream call.
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (err) {
      this.logger.error(`Groq transcription request failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Could not reach the Groq API for audio transcription.',
      );
    }
  }
}
