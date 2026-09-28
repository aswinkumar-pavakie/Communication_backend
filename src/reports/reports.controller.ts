import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List placement-readiness reports (generates a fresh one if the latest is stale).',
  })
  findAll(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reportsService.findAll(
      studentProfileId,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single report by id.' })
  findOne(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.findOne(studentProfileId, id);
  }
}
