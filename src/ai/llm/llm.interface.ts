export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface GenerateRequest {
  systemPrompt: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** When 'json', providers should return a parseable JSON string in `content`. */
  responseFormat?: 'text' | 'json';
  /**
   * Structural hint for the exact skill codes the caller expects in a JSON assessment
   * response (the prompt text already asks for these in prose - this lets the mock
   * provider honor the same contract without parsing its own prompt).
   */
  expectedSkillCodes?: string[];
}

export interface GenerateTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResult {
  content: string;
  tokensUsed?: GenerateTokenUsage;
}

export interface LanguageModelProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}
