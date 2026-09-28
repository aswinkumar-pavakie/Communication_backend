import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty() @IsUUID() attemptId: string;
  @ApiProperty() @IsUUID() questionId: string;

  @ApiProperty({
    example: 'I led a team of four to build a placement-training platform...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  answerText: string;
}
