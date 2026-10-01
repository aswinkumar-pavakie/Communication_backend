import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType, MessageRole } from '#prisma-client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LlmMessage, LlmMessageRole } from '../llm/llm.interface.js';
import { LanguageModelService } from '../llm/llm.service.js';
import { ConversationRequestDto } from './dto/conversation-request.dto.js';
import { ConversationResponseDto } from './dto/conversation-response.dto.js';
import { buildConversationSystemPrompt } from './prompts/conversation-system.prompt.js';

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LanguageModelService,
  ) {}

  async converse(
    studentId: string,
    dto: ConversationRequestDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.loadOrCreateConversation(studentId, dto);

    const activity = conversation.activityId
      ? await this.prisma.activity.findUnique({
          where: { id: conversation.activityId },
        })
      : null;

    // Newest N messages (not the first N), back in chronological order for the model.
    const history = (
      await this.prisma.conversationMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY_MESSAGES,
      })
    ).reverse();

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.message,
      },
    });

    // System instructions are always constructed here from trusted DB data - a client
    // can never inject or override the system prompt via the request body.
    const systemPrompt = buildConversationSystemPrompt({
      type: conversation.type,
      activityTitle: activity?.title,
      activityInstructions: activity?.instructions ?? undefined,
    });

    const llmMessages: LlmMessage[] = [
      ...history.map((h) => ({
        role: h.role.toLowerCase() as LlmMessageRole,
        content: h.content,
      })),
      { role: 'user', content: dto.message },
    ];

    const result = await this.llmService.generate({
      systemPrompt,
      messages: llmMessages,
      temperature: 0.7,
    });

    const assistantMessage = await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: result.content,
      },
    });

    return {
      conversationId: conversation.id,
      message: {
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  private async loadOrCreateConversation(
    studentId: string,
    dto: ConversationRequestDto,
  ) {
    if (dto.conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, studentId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found.');
      }
      return conversation;
    }

    return this.prisma.conversation.create({
      data: {
        studentId,
        type: dto.type ?? ConversationType.GENERAL,
        activityId: dto.activityId,
      },
    });
  }
}
