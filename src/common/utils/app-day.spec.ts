import {
  addDays,
  appDay,
  appDayKey,
  localMidnight,
  startOfAppDay,
} from './app-day.js';

describe('app-day (Asia/Kolkata, UTC+05:30)', () => {
  const TZ = 'Asia/Kolkata';

  it('keeps 23:00 IST on the same local day even though it is 17:30 UTC', () => {
    expect(appDayKey(new Date('2026-09-30T17:30:00Z'), TZ)).toBe('2026-09-30');
  });

  it('counts 01:00 IST as the new local day even though UTC is still the previous day', () => {
    // 2026-09-30 19:30 UTC == 2026-10-01 01:00 IST
    expect(appDayKey(new Date('2026-09-30T19:30:00Z'), TZ)).toBe('2026-10-01');
  });

  it('represents a local day as UTC midnight of that date', () => {
    expect(appDay(new Date('2026-09-30T19:30:00Z'), TZ).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(addDays(new Date('2026-09-30T00:00:00Z'), 1).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('finds the real instant of local midnight', () => {
    // Local midnight 2026-10-01 IST == 2026-09-30 18:30 UTC
    expect(
      startOfAppDay(new Date('2026-10-01T09:00:00+05:30'), TZ).toISOString(),
    ).toBe('2026-09-30T18:30:00.000Z');
  });
});

describe('localMidnight', () => {
  it('gives the UTC instant of local midnight for a date, rolling months over', () => {
    expect(localMidnight(2026, 10, 1, 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-30T18:30:00.000Z',
    );
    expect(localMidnight(2026, 13, 1, 'Asia/Kolkata').toISOString()).toBe(
      '2026-12-31T18:30:00.000Z',
    );
  });
});
