import { Injectable } from '@nestjs/common';
import {
  GenerateRequest,
  GenerateResult,
  LanguageModelProvider,
} from '../llm.interface.js';

const FILLER_WORDS = new Set([
  'um',
  'uh',
  'like',
  'actually',
  'basically',
  'literally',
]);
const IDEAL_SENTENCE_LENGTH = 15;

interface MockSkillScore {
  skillCode: string;
  score: number;
}

interface MockAssessment {
  overallScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestedResponse: string;
  skillScores: MockSkillScore[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Rule-based stand-in for a real LLM (GPT/Claude/Gemini). It never calls a paid API - it
 * derives plausible conversational replies and structured assessment JSON from simple text
 * heuristics (word count, lexical diversity, filler-word density). Swap LLM_PROVIDER once a
 * real provider adapter is implemented; call sites never need to change.
 */
@Injectable()
export class MockLanguageModelProvider implements LanguageModelProvider {
  readonly name = 'mock';

  generate(request: GenerateRequest): Promise<GenerateResult> {
    const lastUserMessage =
      [...request.messages].reverse().find((m) => m.role === 'user')?.content ??
      '';

    const content =
      request.responseFormat === 'json'
        ? JSON.stringify(
            this.buildAssessment(lastUserMessage, request.expectedSkillCodes),
          )
        : this.buildConversationalReply(lastUserMessage);

    const approxTokens = Math.ceil(
      (request.systemPrompt.length + lastUserMessage.length + content.length) /
        4,
    );

    return Promise.resolve({
      content,
      tokensUsed: {
        promptTokens: Math.ceil(
          (request.systemPrompt.length + lastUserMessage.length) / 4,
        ),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: approxTokens,
      },
    });
  }

  private buildConversationalReply(lastUserMessage: string): string {
    const trimmed = lastUserMessage.trim();
    if (!trimmed) {
      return "I'm ready when you are - go ahead and share your response. (mock LLM reply - configure LLM_PROVIDER for a real conversational AI)";
    }

    const preview =
      trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
    return (
      `Thanks for sharing that. I heard you say: "${preview}". Could you expand a bit more, ` +
      `especially on the specific outcome or example? (mock LLM reply - configure LLM_PROVIDER for a real conversational AI)`
    );
  }

  private buildAssessment(
    transcript: string,
    expectedSkillCodes?: string[],
  ): MockAssessment {
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const skillCodes = expectedSkillCodes?.length
      ? expectedSkillCodes
      : [
          'GRAMMAR',
          'VOCABULARY',
          'FLUENCY',
          'CLARITY',
          'CONFIDENCE',
          'PROFESSIONAL_TONE',
        ];

    if (wordCount === 0) {
      return {
        overallScore: 0,
        feedback: 'No speech or text was detected to assess.',
        strengths: [],
        weaknesses: ['No response provided.'],
        suggestedResponse: 'Try answering again with a few complete sentences.',
        skillScores: skillCodes.map((skillCode) => ({ skillCode, score: 0 })),
      };
    }

    const uniqueWords = new Set(
      words.map((w) => w.toLowerCase().replace(/[^a-z']/g, '')),
    ).size;
    const lexicalDiversity = uniqueWords / wordCount;
    const sentences = transcript
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const avgSentenceLength = sentences.length
      ? wordCount / sentences.length
      : wordCount;
    const fillerCount = words.filter((w) =>
      FILLER_WORDS.has(w.toLowerCase()),
    ).length;
    const fillerRatio = fillerCount / wordCount;

    const fluencyScore = clamp(
      85 -
        Math.abs(avgSentenceLength - IDEAL_SENTENCE_LENGTH) * 2 -
        fillerRatio * 100,
    );
    const vocabularyScore = clamp(50 + lexicalDiversity * 100);
    const grammarScore = clamp(78 - fillerRatio * 40);
    const clarityScore = clamp(85 - Math.max(0, avgSentenceLength - 22) * 3);
    const confidenceScore = clamp(
      55 + Math.min(wordCount, 80) * 0.3 - fillerRatio * 60,
    );
    const professionalToneScore = clamp(75 - fillerRatio * 50);
    const genericScore = clamp(
      (fluencyScore +
        vocabularyScore +
        grammarScore +
        clarityScore +
        confidenceScore +
        professionalToneScore) /
        6,
    );

    // Skill codes this heuristic can score specifically; anything else (e.g. INTERVIEW,
    // CRITICAL_THINKING, TECHNICAL_COMMUNICATION, LISTENING, PRONUNCIATION) falls back to
    // the generic overall heuristic - a real LLM would score these more precisely.
    const specificScores: Record<string, number> = {
      GRAMMAR: grammarScore,
      VOCABULARY: vocabularyScore,
      FLUENCY: fluencyScore,
      CLARITY: clarityScore,
      CONFIDENCE: confidenceScore,
      PROFESSIONAL_TONE: professionalToneScore,
    };

    const skillScores: MockSkillScore[] = skillCodes.map((skillCode) => ({
      skillCode,
      score: specificScores[skillCode] ?? genericScore,
    }));

    const overallScore = clamp(
      skillScores.reduce((sum, s) => sum + s.score, 0) / skillScores.length,
    );

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (vocabularyScore >= 70) strengths.push('Good range of vocabulary.');
    else weaknesses.push('Try using a wider variety of words.');
    if (fillerRatio < 0.03)
      strengths.push('Minimal filler words - sounds confident.');
    else weaknesses.push('Reduce filler words like "um" and "like".');
    if (avgSentenceLength > 6 && avgSentenceLength < 25)
      strengths.push('Well-structured sentence length.');
    else weaknesses.push('Work on sentence structure and pacing.');

    return {
      overallScore,
      feedback:
        'Automated mock feedback: this is a rule-based approximation for local development, ' +
        'not a real language-model assessment. Configure LLM_PROVIDER for production-grade feedback.',
      strengths,
      weaknesses,
      suggestedResponse:
        'Consider structuring your answer as: context, action you took, and the result or learning.',
      skillScores,
    };
  }
}
