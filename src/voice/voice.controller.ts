import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AnalyzeVoiceDto } from './dto/analyze-voice.dto.js';
import { SynthesizeDto } from './dto/synthesize.dto.js';
import { VoiceService } from './voice.service.js';

const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024;

@ApiTags('voice')
@ApiBearerAuth()
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Transcribe an audio recording to text (speech-to-text only).',
  })
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_SIZE_BYTES } }),
  )
  transcribe(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @UploadedFile() audio?: Express.Multer.File,
  ) {
    if (!audio) {
      throw new BadRequestException('An "audio" file is required.');
    }
    return this.voiceService.transcribe(studentProfileId, audio.buffer);
  }

  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Synthesize text to speech (text-to-speech only).' })
  synthesize(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Body() dto: SynthesizeDto,
  ) {
    return this.voiceService.synthesize(studentProfileId, dto.text, {
      voice: dto.voice,
      language: dto.language,
      speed: dto.speed,
      format: dto.format,
    });
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Full voice pipeline: transcribe, assess against an activity, and return spoken feedback.',
  })
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_SIZE_BYTES } }),
  )
  analyze(
    @CurrentUser('studentProfileId') studentProfileId: string,
    @Body() dto: AnalyzeVoiceDto,
    @UploadedFile() audio?: Express.Multer.File,
  ) {
    if (!audio) {
      throw new BadRequestException('An "audio" file is required.');
    }
    return this.voiceService.analyze(
      studentProfileId,
      dto.activityId,
      audio.buffer,
      audio.mimetype,
    );
  }
}
