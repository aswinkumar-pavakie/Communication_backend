import { Injectable } from '@nestjs/common';
import { AiUsageService } from '../ai/usage/ai-usage.service.js';
import { SpeechToTextService } from '../ai/stt/stt.service.js';
import { TranscribeOptions } from '../ai/stt/stt.interface.js';
import { TextToSpeechService } from '../ai/tts/tts.service.js';
import { SynthesizeOptions } from '../ai/tts/tts.interface.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class VoiceService {
  constructor(
    private readonly sttService: SpeechToTextService,
    private readonly ttsService: TextToSpeechService,
    private readonly storageService: StorageService,
    private readonly attemptsService: AttemptsService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  async transcribe(
    studentId: string,
    audio: Buffer,
    options?: TranscribeOptions,
  ) {
    const result = await this.sttService.transcribe(audio, options);

    await this.aiUsageService.record({
      studentId,
      provider: this.sttService.providerName,
      service: 'STT',
      requestType: 'transcribe',
      audioDurationSeconds: result.durationSeconds,
    });

    return result;
  }

  async synthesize(
    studentId: string,
    text: string,
    options?: SynthesizeOptions,
  ) {
    const result = await this.ttsService.synthesize(text, options);

    await this.aiUsageService.record({
      studentId,
      provider: this.ttsService.providerName,
      service: 'TTS',
      requestType: 'synthesize',
      audioDurationSeconds: result.durationSeconds,
    });

    return {
      audioBase64: result.audio.toString('base64'),
      format: result.format,
      durationSeconds: result.durationSeconds,
    };
  }

  async analyze(
    studentId: string,
    activityId: string,
    audio: Buffer,
    mimeType: string,
  ) {
    const { path } = await this.storageService.upload({
      buffer: audio,
      fileName: `recording.${this.extensionFromMimeType(mimeType)}`,
      contentType: mimeType,
      folder: 'voice-attempts',
    });

    const transcription = await this.sttService.transcribe(audio);
    await this.aiUsageService.record({
      studentId,
      provider: this.sttService.providerName,
      service: 'STT',
      requestType: 'analyze',
      audioDurationSeconds: transcription.durationSeconds,
    });

    const { attempt, assessment } =
      await this.attemptsService.createVoiceAttempt(
        studentId,
        activityId,
        transcription.transcript,
        path,
      );

    const feedbackAudio = await this.ttsService.synthesize(assessment.feedback);
    await this.aiUsageService.record({
      studentId,
      provider: this.ttsService.providerName,
      service: 'TTS',
      requestType: 'analyze-feedback',
      audioDurationSeconds: feedbackAudio.durationSeconds,
    });

    return {
      attempt,
      assessment,
      transcript: transcription.transcript,
      audioFeedback: {
        audioBase64: feedbackAudio.audio.toString('base64'),
        format: feedbackAudio.format,
        durationSeconds: feedbackAudio.durationSeconds,
      },
    };
  }

  private extensionFromMimeType(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
      'audio/mp4': 'm4a',
    };
    return map[mimeType] ?? 'bin';
  }
}
