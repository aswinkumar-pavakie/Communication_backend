import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SkillCode } from '#prisma-client';
import { LlmAssessmentResultDto } from './dto/llm-assessment-result.dto.js';

/**
 * Never trust raw LLM output. This service parses the JSON string an LLM returned and
 * validates it against LlmAssessmentResultDto before anything downstream is allowed to use
 * or persist it. Malformed output is rejected with a controlled error rather than silently
 * stored as an assessment.
 */
const VALID_SKILL_CODES = new Set<string>(Object.values(SkillCode));

/**
 * The model sometimes returns "Grammar", "professional tone" or a code that doesn't exist,
 * or the same skill twice. Persisting those fails the whole completion transaction (invalid
 * enum / unique constraint), so normalise to known codes and keep one score per skill.
 */
export function normalizeSkillScores<
  T extends { skillCode: string; score: number },
>(scores: T[]): T[] {
  const byCode = new Map<string, T>();
  for (const s of scores) {
    const code = s.skillCode
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (VALID_SKILL_CODES.has(code))
      byCode.set(code, { ...s, skillCode: code });
  }
  return [...byCode.values()];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  async parseAndValidate(rawContent: string): Promise<LlmAssessmentResultDto> {
    const parsed = this.safeParseJson(rawContent);
    if (!parsed) {
      throw new UnprocessableEntityException(
        'The AI assessment could not be generated in a valid format. Please try again.',
      );
    }

    const dto = plainToInstance(LlmAssessmentResultDto, parsed);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      this.logger.warn(
        `Rejected malformed LLM assessment output: ${JSON.stringify(errors)}`,
      );
      throw new UnprocessableEntityException(
        'The AI assessment response did not match the expected format. Please try again.',
      );
    }

    dto.skillScores = normalizeSkillScores(dto.skillScores);
    return dto;
  }

  /** Attempts a plain JSON.parse, then a safe recovery for output wrapped in markdown fences. */
  private safeParseJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      const match =
        raw.match(/```(?:json)?\s*([\s\S]*?)```/i) ?? raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return null;
      }
      try {
        return JSON.parse(match[1] ?? match[0]);
      } catch {
        return null;
      }
    }
  }
}
