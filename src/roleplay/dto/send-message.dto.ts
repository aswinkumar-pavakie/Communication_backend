import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty() @IsUUID() sessionId: string;

  @ApiProperty({
    example:
      'I understand your concern - can we walk through the approach together?',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
