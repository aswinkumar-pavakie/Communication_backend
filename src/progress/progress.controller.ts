import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ProgressService } from './progress.service.js';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  @ApiOperation({
    summary: 'Overall communication score and per-skill snapshot.',
  })
  getOverview(@CurrentUser('studentProfileId') studentProfileId: string) {
    return this.progressService.getOverview(studentProfileId);
  }

  @Get('skills')
  @ApiOperation({ summary: 'Per-skill score breakdown.' })
  getSkills(@CurrentUser('studentProfileId') studentProfileId: string) {
    return this.progressService.getSkills(studentProfileId);
  }

  @Get('history')
  @ApiOperation({
    summary:
      'Historical skill trends, recent assessments, and weekly activity.',
  })
  getHistory(@CurrentUser('studentProfileId') studentProfileId: string) {
    return this.progressService.getHistory(studentProfileId);
  }
}
