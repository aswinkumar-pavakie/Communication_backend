import { ApiProperty } from '@nestjs/swagger';
import { DebatePosition } from '#prisma-client';
import { IsEnum } from 'class-validator';

export class StartDebateDto {
  @ApiProperty({ enum: DebatePosition })
  @IsEnum(DebatePosition)
  position: DebatePosition;
}
