import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class StreakRemindersDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  streakReminderEmails: boolean;
}
