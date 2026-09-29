import { InternalServerErrorException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { VoiceService } from './voice.service.js';

function buildService(storage: {
  isConfigured: () => boolean;
  upload: (...args: unknown[]) => Promise<{ path: string }>;
}) {
  const stt = {
    providerName: 'groq',
    transcribe: jest.fn(async () => ({
      transcript: 'Hello, my name is Asha.',
      durationSeconds: 3,
    })),
  };
  const tts = {
    providerName: 'groq',
    synthesize: jest.fn(async () => ({
      audio: Buffer.from('mp3-bytes'),
      format: 'mp3',
      durationSeconds: 2,
    })),
  };
  const attempts = {
    createVoiceAttempt: jest.fn(async () => ({
      attempt: { id: 'attempt-1' },
      assessment: { feedback: 'Nice and clear.' },
    })),
  };
  const usage = { record: jest.fn(async () => undefined) };

  const service = new VoiceService(
    stt as never,
    tts as never,
    storage as never,
    attempts as never,
    usage as never,
  );
  return { service, stt, attempts };
}

describe('VoiceService.analyze', () => {
  const audio = Buffer.from('audio');

  it('stores the recording path when storage is configured', async () => {
    const upload = jest.fn(async () => ({ path: 'voice-attempts/x.m4a' }));
    const { service, attempts } = buildService({
      isConfigured: () => true,
      upload,
    });

    const result = await service.analyze('s1', 'a1', audio, 'audio/m4a');

    expect(upload).toHaveBeenCalledTimes(1);
    expect(attempts.createVoiceAttempt).toHaveBeenCalledWith(
      's1',
      'a1',
      'Hello, my name is Asha.',
      'voice-attempts/x.m4a',
    );
    expect(result.transcript).toBe('Hello, my name is Asha.');
  });

  it('still scores the answer when storage is not configured', async () => {
    const upload = jest.fn(async () => ({ path: 'unused' }));
    const { service, attempts, stt } = buildService({
      isConfigured: () => false,
      upload,
    });

    const result = await service.analyze('s1', 'a1', audio, 'audio/m4a');

    expect(upload).not.toHaveBeenCalled();
    expect(stt.transcribe).toHaveBeenCalledWith(audio);
    expect(attempts.createVoiceAttempt).toHaveBeenCalledWith(
      's1',
      'a1',
      'Hello, my name is Asha.',
      null,
    );
    expect(result.audioFeedback.audioBase64).toBe(
      Buffer.from('mp3-bytes').toString('base64'),
    );
  });

  it('still scores the answer when the upload fails', async () => {
    const { service, attempts } = buildService({
      isConfigured: () => true,
      upload: async () => {
        throw new InternalServerErrorException('bucket missing');
      },
    });

    await service.analyze('s1', 'a1', audio, 'audio/m4a');

    expect(attempts.createVoiceAttempt).toHaveBeenCalledWith(
      's1',
      'a1',
      'Hello, my name is Asha.',
      null,
    );
  });
});
