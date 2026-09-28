import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '#prisma-client';

export class ConversationMessageDto {
  @ApiProperty({ enum: MessageRole }) role: MessageRole;
  @ApiProperty() content: string;
  @ApiProperty() createdAt: Date;
}

export class ConversationResponseDto {
  @ApiProperty() conversationId: string;
  @ApiProperty({ type: ConversationMessageDto })
  message: ConversationMessageDto;
}
