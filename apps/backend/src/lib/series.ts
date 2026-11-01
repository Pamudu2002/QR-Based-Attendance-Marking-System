// Weekly repeat for sessions. Pure: no database.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "Lecture 10" → "Lecture 11" for the next week. Titles without a number stay the same. */
export function nthTitle(title: string, n: number): string {
  const m = title.match(/^(.*?)(\d+)$/);
  if (!m || n === 0) return title;
  return `${m[1]}${Number(m[2]) + n}`;
}

export type SessionTimes = { title: string; startsAt: Date; endsAt: Date };

/**
 * Expands one session into `weeks` weekly copies. Adds whole weeks in UTC,
 * which is correct for timezones without daylight saving (Sri Lanka has none).
 */
export function expandWeekly(first: SessionTimes, weeks: number): SessionTimes[] {
  return Array.from({ length: weeks }, (_, i) => ({
    title: nthTitle(first.title, i),
    startsAt: new Date(first.startsAt.getTime() + i * WEEK_MS),
    endsAt: new Date(first.endsAt.getTime() + i * WEEK_MS),
  }));
}
