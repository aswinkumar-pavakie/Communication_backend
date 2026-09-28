import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CompleteDebateDto {
  @ApiProperty() @IsUUID() sessionId: string;
}
