// Vercel runs in UTC, so day math and formatting use the zone the layout script
// stores in the tz cookie. Plain Intl only, so `node src/lib/tz.check.ts` can import it.

export function timeZoneFrom(cookie: string | undefined): string {
  if (cookie) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: cookie }); // throws RangeError for an unknown zone
      return cookie;
    } catch {
      // fall through to the default zone
    }
  }
  // shortcut: a missing or bad cookie means the launch campus zone, ask for the zone if we launch elsewhere
  return "America/Los_Angeles";
}

function wallClock(timeZone: string, date: Date) {
  const parts: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date)) {
    parts[part.type] = Number(part.value);
  }
  return parts;
}

// Milliseconds the zone's clock is ahead of UTC at a whole-second instant.
function offset(timeZone: string, instant: number) {
  const p = wallClock(timeZone, new Date(instant));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
}

// The first instant of that date on the zone's clock. Date.UTC rolls day overflow.
function midnight(timeZone: string, year: number, month: number, day: number) {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offset(timeZone, guess);
  const firstOffset = offset(timeZone, first);
  const second = guess - firstOffset;
  // A DST change between guess and midnight needs the second pass. Where DST skips
  // midnight itself (Chile), neither pass reads 00:00 and the later one starts the day.
  return new Date(offset(timeZone, second) === firstOffset ? second : Math.max(first, second));
}

export function dayBounds(timeZone: string, now = new Date()) {
  const { year, month, day } = wallClock(timeZone, now);
  return { start: midnight(timeZone, year, month, day), end: midnight(timeZone, year, month, day + 1) };
}

export function localHour(timeZone: string, now = new Date()) {
  return wallClock(timeZone, now).hour;
}

export function formatTime(value: string | Date, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
}

export function formatDate(value: Date, timeZone: string) {
  return value.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" });
}
