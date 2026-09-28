import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    example:
      'Dear Hiring Manager, I am writing to follow up on my application...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;
}
