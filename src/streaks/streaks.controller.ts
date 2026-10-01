import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { appDayKey } from '../common/utils/app-day.js';
import { StreakCalendarQueryDto } from './dto/streak-calendar-query.dto.js';
import { StreakRemindersDto } from './dto/streak-reminders.dto.js';
import { StreaksService } from './streaks.service.js';

@ApiTags('streaks')
@ApiBearerAuth()
@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get('calendar')
  @ApiOperation({
    summary:
      'Practice counts per day for one month (streak calendar), plus current and best streak.',
  })
  calendar(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Query() query: StreakCalendarQueryDto,
  ) {
    const month = query.month ?? appDayKey(new Date()).slice(0, 7);
    return this.streaksService.getCalendar(studentProfileId, month);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Whether the evening streak-reminder email is on.' })
  reminders(@CurrentUser('studentProfileId') studentProfileId: string) {
    return this.streaksService.getReminderPreference(studentProfileId);
  }

  @Patch('reminders')
  @ApiOperation({
    summary: 'Turn the evening streak-reminder email on or off.',
  })
  setReminders(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Body() dto: StreakRemindersDto,
  ) {
    return this.streaksService.setReminderPreference(
      studentProfileId,
      dto.streakReminderEmails,
    );
  }
}
