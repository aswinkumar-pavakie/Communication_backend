import { MockTextToSpeechProvider } from './mock-text-to-speech.provider.js';

describe('MockTextToSpeechProvider', () => {
  let provider: MockTextToSpeechProvider;

  beforeEach(() => {
    provider = new MockTextToSpeechProvider();
  });

  it('returns a valid, non-empty WAV buffer', async () => {
    const result = await provider.synthesize(
      'Hello, this is a test sentence for synthesis.',
    );

    expect(result.format).toBe('wav');
    expect(result.audio.length).toBeGreaterThan(44); // header + at least some audio data
    expect(result.audio.toString('ascii', 0, 4)).toBe('RIFF');
    expect(result.audio.toString('ascii', 8, 12)).toBe('WAVE');
  });

  it('produces a longer duration for longer text', async () => {
    const short = await provider.synthesize('Hello.');
    const long = await provider.synthesize(
      'This is a much longer sentence that should take noticeably more time to speak aloud than the short one.',
    );

    expect(long.durationSeconds ?? 0).toBeGreaterThan(
      short.durationSeconds ?? 0,
    );
  });

  it('respects a requested output format label', async () => {
    const result = await provider.synthesize('Hello.', { format: 'mp3' });
    expect(result.format).toBe('mp3');
  });
});
