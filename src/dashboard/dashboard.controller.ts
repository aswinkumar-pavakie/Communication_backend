import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Aggregated student dashboard: scores, activities, recommendations.',
  })
  getDashboard(@CurrentUser('studentProfileId') studentProfileId: string) {
    return this.dashboardService.getDashboard(studentProfileId);
  }
}
