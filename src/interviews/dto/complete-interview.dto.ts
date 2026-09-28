import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CompleteInterviewDto {
  @ApiProperty() @IsUUID() attemptId: string;
}
