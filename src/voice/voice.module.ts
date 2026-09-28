import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [AiModule, StorageModule, AttemptsModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
