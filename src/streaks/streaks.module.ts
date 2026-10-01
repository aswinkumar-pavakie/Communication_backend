import { Module } from '@nestjs/common';
import { StreakReminderService } from './streak-reminder.service.js';
import { StreaksController } from './streaks.controller.js';
import { StreaksService } from './streaks.service.js';

@Module({
  controllers: [StreaksController],
  providers: [StreaksService, StreakReminderService],
  exports: [StreaksService],
})
export class StreaksModule {}
