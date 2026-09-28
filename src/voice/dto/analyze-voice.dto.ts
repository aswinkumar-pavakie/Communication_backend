import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AnalyzeVoiceDto {
  @ApiProperty({ description: 'The activity this recording is a response to.' })
  @IsUUID()
  activityId: string;
}
