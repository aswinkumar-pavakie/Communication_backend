/**
 * "What day is it?" for streaks, today's activities and weekly charts.
 *
 * Days are counted in the students' timezone (APP_TIMEZONE, default Asia/Kolkata), not UTC -
 * with UTC, an Indian student's day rolled over at 05:30 and late-night practice could break
 * a streak. A calendar day is represented as a Date at UTC midnight of that local date, the
 * same shape lastStreakDate has always been stored in, so existing rows stay compatible.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** The local calendar date of `date`, as UTC midnight of that date. */
export function appDay(date: Date, timeZone = APP_TIMEZONE): Date {
  const p = localParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** "YYYY-MM-DD" of the local calendar date. */
export function appDayKey(date: Date, timeZone = APP_TIMEZONE): string {
  return appDay(date, timeZone).toISOString().slice(0, 10);
}

export function addDays(day: Date, days: number): Date {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** The real instant local midnight happened today (for `completedAt >= startOfToday` queries). */
export function startOfAppDay(now = new Date(), timeZone = APP_TIMEZONE): Date {
  const p = localParts(now, timeZone);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const offsetMs = asIfUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - offsetMs);
}

/**
 * The real instant of local midnight at the start of a calendar date (month is 1-12; day may
 * overflow, e.g. day 1 of month 13 = Jan 1 next year). Used for month ranges in the streak calendar.
 */
export function localMidnight(
  year: number,
  month: number,
  day: number,
  timeZone = APP_TIMEZONE,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const p = localParts(guess, timeZone);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}
