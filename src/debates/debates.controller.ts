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
import { CompleteDebateDto } from './dto/complete-debate.dto.js';
import { DebateQueryDto } from './dto/debate-query.dto.js';
import { SendArgumentDto } from './dto/send-argument.dto.js';
import { StartDebateDto } from './dto/start-debate.dto.js';
import { DebatesService } from './debates.service.js';

@ApiTags('debates')
@ApiBearerAuth()
@Controller('debates')
export class DebatesController {
  constructor(private readonly debatesService: DebatesService) {}

  @Get()
  @ApiOperation({ summary: 'List debate topics.' })
  findAll(@Query() query: DebateQueryDto) {
    return this.debatesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single debate topic.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.debatesService.findOne(id);
  }

  @Post(':id/sessions')
  @ApiOperation({ summary: 'Start a debate session, choosing FOR or AGAINST.' })
  startSession(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartDebateDto,
  ) {
    return this.debatesService.startSession(studentProfileId, id, dto.position);
  }

  @Post(':id/arguments')
  @ApiOperation({ summary: 'Send an argument in an active debate session.' })
  sendArgument(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _debateId: string,
    @Body() dto: SendArgumentDto,
  ) {
    return this.debatesService.sendArgument(
      studentProfileId,
      dto.sessionId,
      dto.message,
    );
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete a debate session and receive an AI assessment.',
  })
  complete(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _debateId: string,
    @Body() dto: CompleteDebateDto,
  ) {
    return this.debatesService.completeSession(studentProfileId, dto.sessionId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get a debate session with its full argument history.',
  })
  getSession(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.debatesService.getSession(studentProfileId, sessionId);
  }
}
