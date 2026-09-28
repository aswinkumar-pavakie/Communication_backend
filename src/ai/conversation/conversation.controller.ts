import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ConversationRequestDto } from './dto/conversation-request.dto.js';
import { ConversationResponseDto } from './dto/conversation-response.dto.js';
import { ConversationService } from './conversation.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('conversation')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message to the AI communication coach.' })
  converse(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Body() dto: ConversationRequestDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.converse(studentProfileId, dto);
  }
}
