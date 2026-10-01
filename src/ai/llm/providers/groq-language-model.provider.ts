import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../config/configuration.js';
import {
  GenerateRequest,
  GenerateResult,
  LanguageModelProvider,
} from '../llm.interface.js';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

interface GroqChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Real LLM provider backed by Groq's OpenAI-compatible chat completions API
 * (https://api.groq.com/openai/v1/chat/completions, model openai/gpt-oss-120b).
 * Uses the same Groq account/API key as GroqSpeechToTextProvider.
 */
@Injectable()
export class GroqLanguageModelProvider implements LanguageModelProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqLanguageModelProvider.name);

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const apiKey = this.configService.get('ai', { infer: true }).llm.apiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'LLM_PROVIDER=groq is set but LLM_API_KEY is missing. Add your Groq API key to .env.',
      );
    }

    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const body: Record<string, unknown> = {
      model: GROQ_MODEL,
      messages,
      temperature: request.temperature ?? 0.7,
      // Reasoning models spend part of this budget thinking; 1024 could truncate the JSON.
      max_completion_tokens: request.maxTokens ?? 2048,
    };
    if (request.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    let response: Response;
    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        // Never hang a student's request on a stuck upstream call.
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`Groq chat completion request failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Could not reach the Groq API for a chat completion.',
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(
        `Groq chat completion failed: ${response.status} ${errorText}`,
      );
      throw new ServiceUnavailableException(
        `Groq LLM request failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as GroqChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      tokensUsed: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
