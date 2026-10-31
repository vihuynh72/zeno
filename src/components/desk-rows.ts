// Pure rules behind the desk's rows. Type-only imports, so `node src/components/desk-rows.check.ts` runs it.
import type { DayEvent } from "@/lib/day";

export type Mark = "past" | "now" | "next" | null;

// Events that ended go quiet; the one on now is marked, or else the next one. All-day events stay plain.
export function markEvents(events: DayEvent[], now: number): Mark[] {
  const timed = events.map((event) => (event.allDay ? null : { start: Date.parse(event.start), end: Date.parse(event.end) }));
  const marks: Mark[] = timed.map((t) => (t && t.end <= now ? "past" : null));
  const current = timed.findIndex((t) => t && t.start <= now && now < t.end);
  const next = timed.findIndex((t) => t && t.start > now);
  if (current >= 0) marks[current] = "now";
  else if (next >= 0) marks[next] = "next";
  return marks;
}

// "Dana Lee <dana@school.edu>" reads as Dana Lee; a bare address stays as it is.
export function senderName(from: string) {
  const name = from.replace(/<[^>]*>/g, "").trim().replace(/^"(.*)"$/, "$1").trim();
  return name || from.replace(/[<>]/g, "").trim();
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Gmail snippets arrive HTML-escaped ("I&#39;ll"), and React would show the entities as typed.
export function unescapeHtml(text: string) {
  return text.replace(
    /&(?:(amp|lt|gt|quot|apos|nbsp)|#(\d{1,7})|#x([\da-f]{1,6}));/gi,
    (entity, name: string | undefined, dec: string | undefined, hex: string | undefined) => {
      if (name) return NAMED[name.toLowerCase()];
      const code = dec ? Number(dec) : parseInt(hex ?? "", 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    },
  );
}
