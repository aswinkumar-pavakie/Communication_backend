import { ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, RoleplayScenario } from '#prisma-client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class RoleplayQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RoleplayScenario })
  @IsOptional()
  @IsEnum(RoleplayScenario)
  scenario?: RoleplayScenario;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}
