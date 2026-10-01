import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class StreakCalendarQueryDto {
  @ApiPropertyOptional({
    example: '2026-09',
    description: 'Month to show as YYYY-MM. Defaults to the current month.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;
}
