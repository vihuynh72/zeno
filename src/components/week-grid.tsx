"use client";

import { type CSSProperties, type FocusEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WeekEvent, WeekResponse } from "@/lib/day";
import {
  addDays,
  browserZone,
  dateLabel,
  hourRange,
  httpsOnly,
  layoutDay,
  type Placed,
  timeRange,
  wallMinutes,
  weekLabel,
  weekOf,
} from "@/components/desk-rows";
import { formatTime, localDate } from "@/lib/tz";

// The shortest box still holds one 18px line. Rows shrink so the week's hours fit the panel, but never below MIN_HOUR.
const MIN_BOX = 28;
const MIN_HOUR = 28;
// Room kept after each start, so a short event's drawn box (MIN_BOX at the shortest rows) never runs past the last hour.
const TAIL = (MIN_BOX / MIN_HOUR) * 60;
const INDENT = 20; // px a cascaded event starts in from the one it is drawn over
// Faint blocks where a week usually has something, while it loads.
const SKELETON: [day: number, hour: number, hours: number][] = [
  [0, 9, 1],
  [1, 13, 1.5],
  [2, 10, 1],
  [3, 15, 1],
  [4, 9, 1],
];

// A day column's width, one Mono digit's, and the height under the day heads, in px.
type Metrics = { column: number; ch: number; room: number };
// Text cut short in its box, shown whole beside it.
type Peek = { title: string; when: string; at: DOMRect };

const clockLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
const motion = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
// Cut by a line clamp, an ellipsis or the box's own height.
const cut = (el: Element | null) => Boolean(el && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth));

// A mouse over a box, or keyboard focus on its link, shows text the box cuts short in full beside it.
function peekOn(onPeek: (peek: Peek | null) => void, title: string, when: string, isCut: (el: HTMLElement) => boolean) {
  const show = (el: HTMLElement) => isCut(el) && onPeek({ title, when, at: el.getBoundingClientRect() });
  return {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => event.pointerType === "mouse" && show(event.currentTarget),
    onPointerLeave: () => onPeek(null),
    onFocus: (event: FocusEvent<HTMLElement>) => event.target.matches(":focus-visible") && show(event.currentTarget),
    onBlur: () => onPeek(null),
  };
}

// The desk's Week, read-only: seven days like Google Calendar, Zeno's blocks as small red-margined cards, and each
// event a link to it in Google Calendar. The week's hours fit the panel; phones show one day (three on tablets) that
// swipes or steps, never a squeezed grid.
export default function WeekGrid({ now, onSignIn }: { now: number; onSignIn(): void }) {
  const [picked, setPicked] = useState<string | null>(null); // a Monday the person moved to; null is the one it opens on
  const [weeks, setWeeks] = useState<Record<string, WeekResponse>>({});
  const [attempt, setAttempt] = useState(0);
  const [metrics, setMetrics] = useState<Metrics>({ column: 0, ch: 0, room: 0 });
  const [peek, setPeek] = useState<Peek | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const edge = useRef<"start" | "end" | "today" | null>("today");
  const pop = useRef<HTMLDivElement>(null);

  // Before the browser knows the time (server render), the frame shows without days.
  const home = now ? weekOf(localDate(browserZone(), new Date(now))) : null;
  const monday = picked ?? home;
  const week = monday ? weeks[monday] : undefined;
  const zone = week?.state === "ok" ? week.timeZone : browserZone();
  const today = now ? localDate(zone, new Date(now)) : null;
  const dates = monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [];
  const days = week?.state === "ok" ? week.days : null;

  useEffect(() => {
    if (!monday) return;
    fetch(`/api/calendar/week?start=${monday}`)
      .then((response) => response.json() as Promise<WeekResponse>)
      .catch((): WeekResponse => ({ state: "error" }))
      // A failed refresh keeps the week already on screen.
      .then((data) => setWeeks((all) => (data.state !== "ok" && all[monday]?.state === "ok" ? all : { ...all, [monday]: data })));
  }, [monday, attempt]);

  // The dialog can open after the grid mounts (straight onto Week), so sizes are read whenever the panel or the day
  // heads (taller with all-day chips) change.
  const attach = useCallback((el: HTMLDivElement | null) => {
    scroller.current = el;
    if (!el) return;
    const measure = () => {
      const column = el.querySelector<HTMLElement>(".week-day")?.offsetWidth ?? 0;
      const ch = (el.querySelector<HTMLElement>(".week-ch")?.offsetWidth ?? 0) / 10;
      const room = el.clientHeight - (el.querySelector<HTMLElement>(".week-corner")?.offsetHeight ?? 0);
      setMetrics((was) => (was.column === column && was.ch === ch && was.room === room ? was : { column, ch, room }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const corner = el.querySelector(".week-corner");
    if (corner) observer.observe(corner);
    void document.fonts.ready.then(measure);
    measure(); // before the first paint, when the desk is already open
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !edge.current || !metrics.column) return;
    el.scrollLeft = { start: 0, end: el.scrollWidth, today: Math.max(0, dates.indexOf(today ?? "")) * metrics.column }[edge.current];
    edge.current = null;
  });

  useLayoutEffect(() => {
    const el = pop.current;
    if (!el) return;
    if (!peek) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    if (!el.matches(":popover-open")) el.showPopover();
    const { width, height } = el.getBoundingClientRect();
    const { top, right, bottom, left } = peek.at;
    // Beside the box, else below or above it; clamped as a last resort.
    const fits = ([x, y]: number[]) => x >= 16 && y >= 16 && x + width <= innerWidth - 16 && y + height <= innerHeight - 16;
    const [x, y] = [[right + 8, top], [left - 8 - width, top], [left, bottom + 8], [left, top - 8 - height]].find(fits) ?? [
      Math.max(16, Math.min(left, innerWidth - width - 16)),
      Math.max(16, Math.min(top, innerHeight - height - 16)),
    ];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [peek]);

  function go(to: string | null, scrollTo: "start" | "end" | "today") {
    edge.current = scrollTo;
    setPicked(to);
    setPeek(null);
  }

  // Phones and tablets step a day at a time inside the week, then into the next; the full grid steps whole weeks.
  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el || !monday) return;
    const room = direction < 0 ? el.scrollLeft : el.scrollWidth - el.clientWidth - el.scrollLeft;
    if (metrics.column && room > metrics.column / 2) el.scrollBy({ left: direction * metrics.column, behavior: motion() });
    else go(addDays(monday, direction * 7), direction < 0 ? "end" : "start");
  }

  if (week && week.state !== "ok") {
    const noAccess = week.state === "no-access" || week.state === "signed-out";
    return (
      <div className="flex flex-col items-start gap-4">
        <section className="mini self-stretch">
          <ul className="lines">
            <li>{noAccess ? "Connect your calendar to see your week here." : "Zeno couldn't read your calendar just now."}</li>
          </ul>
        </section>
        {noAccess ? (
          <button type="button" onClick={onSignIn} className="pill pill-ink">
            Connect your calendar
          </button>
        ) : (
          <button
            type="button"
            className="pill"
            onClick={() => {
              setWeeks((all) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== monday)));
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const empty = days?.every((day) => day.events.length === 0);
  const nowMinutes = today && now ? wallMinutes(now, today, zone) : 0;
  const { from, to } = hourRange(dates.flatMap((date, i) => layoutDay(days?.[i]?.events ?? [], date, zone)), TAIL);
  const hourPx = Math.max(MIN_HOUR, Math.floor(metrics.room / (to - from)));
  const y = (minutes: number) => ((minutes - from * 60) / 60) * hourPx;

  return (
    <>
      <div className="week-bar">
        <h2 className="text-[20px] font-bold">
          <span className="sr-only">Week of </span>
          {monday ? weekLabel(monday) : "This week"}
        </h2>
        <div role="status" className="week-status">
          {!days && <p className="sr-only">Loading your week…</p>}
          {empty && <p className="text-ink-2">Nothing on your calendar this week.</p>}
        </div>
        <div className="week-nav">
          {monday && home && monday !== home && (
            <button type="button" onClick={() => go(null, "today")} className="pill pill-small pill-quiet">
              This week
            </button>
          )}
          <button type="button" onClick={() => move(-1)} aria-label="Earlier" className="pill pill-small week-step">
            <Chevron d="M15 5l-7 7 7 7" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Later" className="pill pill-small week-step">
            <Chevron d="M9 5l7 7-7 7" />
          </button>
        </div>
      </div>

      <div ref={attach} className="week-scroll" aria-busy={!days || undefined}>
        <div className="week-sheet" style={{ "--hour": `${hourPx}px`, gridTemplateRows: `auto ${(to - from) * hourPx}px` } as CSSProperties}>
          <div className="week-corner" aria-hidden="true">
            <span className="week-ch font-mono">0000000000</span>
          </div>
          <div className="week-hours" aria-hidden="true">
            {Array.from({ length: to - from - 1 }, (_, i) => from + 1 + i).map((hour) => (
              <span key={hour} style={{ top: y(hour * 60) }}>
                {clockLabel(hour)}
              </span>
            ))}
          </div>
          {dates.map((date, index) => {
            const events = days?.[index]?.events ?? [];
            const placed = layoutDay(events, date, zone, (MIN_BOX / hourPx) * 60);
            const isToday = date === today;
            return (
              <section key={date} className="week-day" aria-labelledby={`week-${date}`} data-today={isToday || undefined}>
                <div className="week-head">
                  <h3 id={`week-${date}`} className="week-date">
                    <span aria-hidden="true">{dateLabel(date, { weekday: "short" })}</span>
                    <span aria-hidden="true" className="week-number font-mono">
                      {Number(date.slice(8))}
                    </span>
                    <span className="sr-only">
                      {dateLabel(date, { weekday: "long", month: "long", day: "numeric" })}
                      {isToday ? ", today" : ""}
                    </span>
                  </h3>
                  {events.some((event) => event.allDay) && (
                    <ul className="week-allday">
                      {events
                        .filter((event) => event.allDay)
                        .map((event, i) => {
                          const link = httpsOnly(event.link);
                          const chip = {
                            className: "week-chip block",
                            "data-zeno": event.zeno || undefined,
                            style: { "--cal": event.color ?? "var(--ink-2)" } as CSSProperties,
                            ...peekOn(setPeek, event.title, "All day", cut),
                          };
                          const label = (
                            <>
                              <span className="sr-only">All day{event.zeno ? ", Zeno" : ""}: </span>
                              {event.title}
                              {link && <span className="sr-only">, opens in Google Calendar</span>}
                            </>
                          );
                          return (
                            <li key={`${event.id}:${i}`} className="min-w-0">
                              {link ? (
                                <a href={link} target="_blank" rel="noopener noreferrer" {...chip}>
                                  {label}
                                </a>
                              ) : (
                                <span {...chip}>{label}</span>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
                <div className="week-body">
                  {!days &&
                    SKELETON.filter(([day]) => day === index).map(([, hour, hours]) => (
                      <div key={hour} className="week-skeleton" aria-hidden="true" style={{ top: y(hour * 60), height: hours * hourPx - 2 }} />
                    ))}
                  <ol className="week-items">
                    {placed.map((box, i) => (
                      <EventBox
                        key={`${box.event.id}:${box.top}:${i}`}
                        box={box}
                        y={y}
                        zone={zone}
                        metrics={metrics}
                        // Text stops where the first event cascaded over this one starts, so nothing peeks out under it.
                        covered={placed.find((other) => other.indent > box.indent && other.top >= box.top && other.top < box.bottom)?.top}
                        past={Boolean(today && (date < today || (isToday && box.bottom <= nowMinutes)))}
                        onPeek={setPeek}
                      />
                    ))}
                    {days && placed.length === 0 && <li className="sr-only">Nothing planned.</li>}
                  </ol>
                  {isToday && nowMinutes > from * 60 && nowMinutes < to * 60 && (
                    <div className="week-now" aria-hidden="true" style={{ top: y(nowMinutes) }} />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Screen readers already have the whole title and time in each event's name. */}
      <div
        ref={pop}
        popover="manual"
        aria-hidden="true"
        className="week-pop pointer-events-none"
        style={{ width: "max-content", maxWidth: "min(320px, calc(100vw - 32px))" }}
      >
        {peek && (
          <>
            <p className="font-bold">{peek.title}</p>
            <p className="font-mono text-ink-2">{peek.when}</p>
          </>
        )}
      </div>
    </>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

type EventBoxProps = {
  box: Placed<WeekEvent>;
  y(minutes: number): number; // a wall-clock minute's place in the grid, px
  zone: string;
  metrics: Metrics;
  covered?: number; // where an event drawn over this one starts
  past: boolean;
  onPeek(peek: Peek | null): void;
};

function EventBox({ box, y, zone, metrics, covered, past, onPeek }: EventBoxProps) {
  const { event } = box;
  const height = Math.max(MIN_BOX, y(box.bottom) - y(box.top)) - 2;
  // Whole 24px lines that fit, above anything cascaded over it.
  const lines = Math.max(1, Math.floor((Math.min(height, covered === undefined ? height : y(covered) - y(box.top)) - 4) / 24));
  const range = timeRange(event.start, event.end, zone);
  const indent = box.indent * INDENT;
  // The text's width: the box's share of the column, less its 2px margin, 4px gap and 18px of padding.
  const room = (metrics.column - 1 - indent) / box.cols - 24;
  // A time is shown whole or not at all: the range, else the start ("8:00 AM", then "8:00").
  const start = formatTime(new Date(event.start), zone);
  const time = metrics.ch > 0 ? [range, start, start.replace(/\s*[AP]M$/, "")].find((label) => label.length * metrics.ch <= room) : undefined;
  const link = httpsOnly(event.link);
  const body = (
    <>
      {event.zeno && <span className="sr-only">Zeno block: </span>}
      {/* The title wraps into every line that fits; the time follows only when a whole line is left for it. */}
      <span data-text className="block overflow-hidden" style={{ maxHeight: lines * 24 }}>
        <span className="week-title" style={{ "--lines": lines } as CSSProperties}>
          {event.title}
        </span>
        {time && (
          <span className="week-time font-mono" aria-hidden="true">
            {time}
          </span>
        )}
      </span>
      <span className="sr-only">
        , {range}
        {link && ", opens in Google Calendar"}
      </span>
    </>
  );
  return (
    <li
      className="week-event"
      data-zeno={event.zeno || undefined}
      data-past={past || undefined}
      {...peekOn(onPeek, event.title, range, (el) => time !== range || cut(el.querySelector("[data-text]")))}
      style={
        {
          top: y(box.top),
          height,
          // Cascaded events start one indent in per level, and share what's left with any that start with them.
          left: `calc(${indent}px + (100% - ${indent}px) * ${box.col / box.cols})`,
          width: `calc((100% - ${indent}px) / ${box.cols} - 4px)`,
          "--cal": event.color ?? "var(--ink-2)",
        } as CSSProperties
      }
    >
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="week-event-tap">
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
