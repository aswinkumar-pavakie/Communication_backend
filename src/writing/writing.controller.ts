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
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { WritingQueryDto } from './dto/writing-query.dto.js';
import { WritingService } from './writing.service.js';

@ApiTags('writing')
@ApiBearerAuth()
@Controller('writing')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Get()
  @ApiOperation({
    summary:
      'List writing activities (emails, requests, professional chat, ...).',
  })
  findAll(@Query() query: WritingQueryDto) {
    return this.writingService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single writing activity.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.writingService.findOne(id);
  }

  @Post(':id/submissions')
  @ApiOperation({
    summary: 'Submit a written response and receive an AI assessment.',
  })
  submit(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.writingService.submit(studentProfileId, id, dto.content);
  }

  @Get(':id/submissions')
  @ApiOperation({
    summary:
      "List the current student's submissions for this writing activity.",
  })
  findSubmissions(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.writingService.findSubmissions(
      studentProfileId,
      id,
      query.page,
      query.limit,
    );
  }
}
