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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CompleteInterviewDto } from './dto/complete-interview.dto.js';
import { InterviewQueryDto } from './dto/interview-query.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { InterviewsService } from './interviews.service.js';

@ApiTags('interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List available mock interviews.' })
  findAll(@Query() query: InterviewQueryDto) {
    return this.interviewsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get interview details (question count, not the questions themselves).',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.interviewsService.findOne(id);
  }

  @Post(':id/start')
  @ApiOperation({
    summary: 'Start a new attempt and receive the first question.',
  })
  start(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.interviewsService.start(studentProfileId, id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Submit an answer and receive the next question.' })
  submitAnswer(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _interviewId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.interviewsService.submitAnswer(
      studentProfileId,
      dto.attemptId,
      dto.questionId,
      dto.answerText,
    );
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete an interview attempt and compute the overall score.',
  })
  complete(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) _interviewId: string,
    @Body() dto: CompleteInterviewDto,
  ) {
    return this.interviewsService.complete(studentProfileId, dto.attemptId);
  }

  @Get(':id/attempts')
  @ApiOperation({
    summary:
      "List the current student's attempts for this interview, with every question and answer. In-progress attempts include the next question so they can be resumed.",
  })
  listAttempts(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.interviewsService.listAttempts(
      studentProfileId,
      id,
      query.page,
      query.limit,
    );
  }

  @Get(':id/result')
  @ApiOperation({
    summary:
      "Get the student's most recent completed result for this interview.",
  })
  getResult(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('attemptId', new ParseUUIDPipe({ optional: true }))
    attemptId?: string,
  ) {
    return this.interviewsService.getResult(studentProfileId, id, attemptId);
  }
}
