import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '#prisma-client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConversationRequestDto {
  @ApiPropertyOptional({ description: 'Omit to start a new conversation.' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({
    example: 'I would like to introduce myself for the interview.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({
    description: 'Ties the conversation to a specific activity for context.',
  })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({
    enum: ConversationType,
    default: ConversationType.GENERAL,
  })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;
}
