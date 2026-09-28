import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendArgumentDto {
  @ApiProperty() @IsUUID() sessionId: string;

  @ApiProperty({
    example: 'AI adoption improves developer productivity because...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
