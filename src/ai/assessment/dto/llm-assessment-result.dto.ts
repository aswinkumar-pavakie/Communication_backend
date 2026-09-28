import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class LlmSkillScoreDto {
  @IsString()
  skillCode: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}

/**
 * The exact JSON contract we require every assessment-capable LLM call to return.
 * Raw LLM output is parsed then validated against this DTO before it is ever trusted
 * or persisted - malformed output is rejected rather than silently stored.
 */
export class LlmAssessmentResultDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore: number;

  @IsString()
  feedback: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  strengths: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  weaknesses: string[];

  @IsOptional()
  @IsString()
  suggestedResponse?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LlmSkillScoreDto)
  skillScores: LlmSkillScoreDto[];
}
