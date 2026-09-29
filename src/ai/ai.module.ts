import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment/assessment.service.js';
import { MockPronunciationProvider } from './assessment/providers/mock-pronunciation.provider.js';
import { PronunciationService } from './assessment/pronunciation.service.js';
import { ScoringService } from './assessment/scoring.service.js';
import { ConversationController } from './conversation/conversation.controller.js';
import { ConversationService } from './conversation/conversation.service.js';
import { MockLanguageModelProvider } from './llm/providers/mock-language-model.provider.js';
import { GroqLanguageModelProvider } from './llm/providers/groq-language-model.provider.js';
import { LanguageModelService } from './llm/llm.service.js';
import { MockSpeechToTextProvider } from './stt/providers/mock-speech-to-text.provider.js';
import { GroqSpeechToTextProvider } from './stt/providers/groq-speech-to-text.provider.js';
import { SpeechToTextService } from './stt/stt.service.js';
import { MockTextToSpeechProvider } from './tts/providers/mock-text-to-speech.provider.js';
import { GoogleTextToSpeechProvider } from './tts/providers/google-text-to-speech.provider.js';
import { GroqTextToSpeechProvider } from './tts/providers/groq-text-to-speech.provider.js';
import { TextToSpeechService } from './tts/tts.service.js';
import { AiUsageService } from './usage/ai-usage.service.js';

@Module({
  controllers: [ConversationController],
  providers: [
    MockSpeechToTextProvider,
    GroqSpeechToTextProvider,
    SpeechToTextService,
    MockLanguageModelProvider,
    GroqLanguageModelProvider,
    LanguageModelService,
    MockTextToSpeechProvider,
    GoogleTextToSpeechProvider,
    GroqTextToSpeechProvider,
    TextToSpeechService,
    MockPronunciationProvider,
    PronunciationService,
    ScoringService,
    AssessmentService,
    ConversationService,
    AiUsageService,
  ],
  exports: [
    SpeechToTextService,
    LanguageModelService,
    TextToSpeechService,
    PronunciationService,
    AssessmentService,
    AiUsageService,
  ],
})
export class AiModule {}
