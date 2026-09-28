import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAttemptDto {
  @ApiProperty({
    description:
      "The student's written or transcribed response to the activity.",
    example:
      'Hello, my name is Aditi and I am a final-year Computer Science student...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  responseText: string;
}
