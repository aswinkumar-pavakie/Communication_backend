import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CompleteSessionDto } from './dto/complete-session.dto.js';
import { RoleplayQueryDto } from './dto/roleplay-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { RoleplayService } from './roleplay.service.js';

@ApiTags('roleplay')
@ApiBearerAuth()
@Controller('roleplays')
export class RoleplayController {
  constructor(private readonly roleplayService: RoleplayService) {}

  @Get()
  @ApiOperation({ summary: 'List workplace roleplay scenarios.' })
  findAll(@Query() query: RoleplayQueryDto) {
    return this.roleplayService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single roleplay scenario.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleplayService.findOne(id);
  }

  @Post(':id/sessions')
  @ApiOperation({
    summary: 'Start a roleplay session and receive the AI opening line.',
  })
  startSession(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.roleplayService.startSession(studentProfileId, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in an active roleplay session.' })
  sendMessage(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _roleplayId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.roleplayService.sendMessage(
      studentProfileId,
      dto.sessionId,
      dto.message,
    );
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete a roleplay session and receive an AI assessment.',
  })
  complete(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _roleplayId: string,
    @Body() dto: CompleteSessionDto,
  ) {
    return this.roleplayService.completeSession(
      studentProfileId,
      dto.sessionId,
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get a roleplay session with its full message history.',
  })
  getSession(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.roleplayService.getSession(studentProfileId, sessionId);
  }
}
