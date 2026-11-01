// Session times are entered and shown in the university's timezone, whatever
// the laptop or server is set to. Safe to import from client components.

export const TIME_ZONE = "Asia/Colombo";

function parts(date: Date, timeZone: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

/** Offset of `timeZone` from UTC at `date`, in ms. */
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-10" + "10:15" in `timeZone` → the UTC instant. */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone = TIME_ZONE): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** The calendar date ("2026-11-10") and time ("10:15") of an instant in `timeZone`. */
export function utcToZoned(date: Date, timeZone = TIME_ZONE): { date: string; time: string } {
  const p = parts(date, timeZone);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Adds days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" string. */
export function weekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options });
    fmtCache.set(key, f);
  }
  return f;
}

/** 10:15 */
export const formatTime = (d: Date) => fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
/** Tue 3 Nov */
export const formatDay = (d: Date) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(d).replace(",", "");
/** 27 Oct, 10:05 */
export const formatDayTime = (d: Date) => `${fmt({ day: "numeric", month: "short" }).format(d)}, ${formatTime(d)}`;
/** Tuesday 3 November 2026 */
export const formatLongDate = (d: Date) =>
  fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d).replace(",", "");
/** November 2026 */
export const formatMonth = (d: Date) => fmt({ month: "long", year: "numeric" }).format(d);
/** Hour of day in TIME_ZONE (0–23). */
export const zonedHour = (d: Date) => Number(parts(d, TIME_ZONE).hour);
