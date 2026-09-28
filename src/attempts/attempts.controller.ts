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
import { AttemptsService } from './attempts.service.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities/:activityId/attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a response to an activity and receive an AI assessment.',
  })
  create(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: CreateAttemptDto,
  ) {
    return this.attemptsService.createTextAttempt(
      studentProfileId,
      activityId,
      dto.responseText,
    );
  }

  @Get()
  @ApiOperation({
    summary: "List the current student's attempts for this activity.",
  })
  findAll(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.attemptsService.findAllForActivity(
      studentProfileId,
      activityId,
      query.page,
      query.limit,
    );
  }
}
