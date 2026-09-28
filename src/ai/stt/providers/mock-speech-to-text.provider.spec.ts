import { MockSpeechToTextProvider } from './mock-speech-to-text.provider.js';

describe('MockSpeechToTextProvider', () => {
  let provider: MockSpeechToTextProvider;

  beforeEach(() => {
    provider = new MockSpeechToTextProvider();
  });

  it('returns an empty transcript for empty audio', async () => {
    const result = await provider.transcribe(Buffer.alloc(0));
    expect(result.transcript).toBe('');
    expect(result.durationSeconds).toBe(0);
    expect(result.segments).toEqual([]);
  });

  it('returns a non-empty transcript and estimated duration for non-empty audio', async () => {
    const audio = Buffer.alloc(16_000 * 2 * 3); // ~3 seconds at 16kHz/16-bit mono
    const result = await provider.transcribe(audio);

    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.durationSeconds).toBeCloseTo(3, 0);
    expect(result.language).toBe('en');
  });

  it('honors an explicit language option', async () => {
    const result = await provider.transcribe(Buffer.alloc(1000), {
      language: 'hi',
    });
    expect(result.language).toBe('hi');
  });
});
