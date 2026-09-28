import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType, Difficulty, SkillCode } from '#prisma-client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ActivityType, description: 'Alias for `type`.' })
  @IsOptional()
  @IsEnum(ActivityType)
  category?: ActivityType;

  @ApiPropertyOptional({ enum: ActivityType })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: SkillCode })
  @IsOptional()
  @IsEnum(SkillCode)
  skill?: SkillCode;
}
