import { ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, WritingType } from '#prisma-client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class WritingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WritingType })
  @IsOptional()
  @IsEnum(WritingType)
  type?: WritingType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}
