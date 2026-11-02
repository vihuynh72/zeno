"use client";

import { type CSSProperties, type MouseEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BookResponse, CalendarBlock, Goal, WeekEvent, WeekResponse } from "@/lib/day";
import {
  addDays,
  browserZone,
  dateLabel,
  dayWord,
  freeGaps,
  type Gap,
  instantAt,
  layoutDay,
  mondayOf,
  PLAN_HOURS,
  planFrom,
  planStart,
  timeRange,
  wallMinutes,
  weekLabel,
} from "@/components/desk-rows";
import { formatTime, localDate } from "@/lib/tz";

// One hour per 64px, the index card's rule spacing; the shortest box still holds one 18px line.
const HOUR = 64;
const MIN_BOX = 28;
const MIN_MINUTES = (MIN_BOX / HOUR) * 60;
const OPENS_AT = 7; // the grid opens scrolled to 7 AM
const FOCUS_MINUTES = 30;
const INDENT = 20; // px a cascaded event starts in from the one it is drawn over
// A popover choice ignores the first moments after it opens, so the second half of a double tap is never a choice.
const SETTLE_MS = 400;
const HOURS = Array.from({ length: 23 }, (_, i) => i + 1);
// Faint blocks where a week usually has something, while it loads.
const SKELETON: [day: number, hour: number, hours: number][] = [
  [0, 9, 1],
  [1, 13, 1.5],
  [2, 10, 1],
  [3, 15, 1],
  [4, 9, 1],
];

type Shown = WeekEvent & { status?: "booking" | "undoing" };
type Target = { kind: "book"; date: string; gap: Gap; at: number } | { kind: "undo"; event: WeekEvent };
type Plan = Target & { x: number; y: number };
// about: the block's title, said to screen readers only (it is right there in the grid).
type Note = { text: string; about?: string; undo?: WeekEvent; signIn?: string };
// What the Week booked or took off, so the desk's Today and the guided goal hear about it.
export type Booked = { event: WeekEvent; stepId?: string; undone?: boolean };
type Metrics = { column: number; ch: number }; // a day column's width and one Mono digit's, in px

const clockLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
const px = (minutes: number) => (minutes / 60) * HOUR;
const motion = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// The desk's Week: seven days like Google Calendar, Zeno's blocks as small red-margined cards, and any open time a
// tap away from a booking. Phones show one day (three on tablets) that swipes or steps, never a squeezed grid.
type WeekGridProps = { goal: Goal | null; now: number; onSignIn(): void; onBooked?(change: Booked): void };

export default function WeekGrid({ goal, now, onSignIn, onBooked }: WeekGridProps) {
  const [picked, setPicked] = useState<string | null>(null); // a Monday the person moved to; null is this week
  const [weeks, setWeeks] = useState<Record<string, WeekResponse>>({});
  const [attempt, setAttempt] = useState(0);
  const [extra, setExtra] = useState<Shown[]>([]); // booked here: shown at once, "Booking…" until Google confirms
  const [mine, setMine] = useState<Record<string, string>>({}); // booked here (so it can be undone): event id to step id, "" for focus
  const [undone, setUndone] = useState<string[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // a double tap lands before the re-render, so the guard can't wait for state
  const [writeLost, setWriteLost] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [ghost, setGhost] = useState<{ date: string; at: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({ column: 0, ch: 0 });
  const scroller = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  const edge = useRef<"start" | "end" | "today" | null>("today");
  const pop = useRef<HTMLDivElement>(null);
  const invoker = useRef<HTMLElement | null>(null);
  const openedAt = useRef(0);
  const status = useRef<HTMLDivElement>(null);
  const refocus = useRef(false); // a booking or undo settled: put focus lost with the popover or block on the status line

  // Before the browser knows the time (server render), the frame shows without days.
  const thisWeek = now ? mondayOf(localDate(browserZone(), new Date(now))) : null;
  const monday = picked ?? thisWeek;
  const week = monday ? weeks[monday] : undefined;
  const zone = week?.state === "ok" ? week.timeZone : browserZone();
  const today = now ? localDate(zone, new Date(now)) : null;
  const dates = monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [];
  const canBook = week?.state === "ok" && week.write === "ok" && !writeLost;
  const needsPermission = week?.state === "ok" && (week.write === "needs-permission" || writeLost);
  const current = goal?.steps.find((s) => s.status === "doing") ?? goal?.steps.find((s) => s.status === "todo");
  // A step already on the calendar is never offered again (a focus block still is).
  const step = current && !current.scheduledAt && !Object.values(mine).includes(current.id) ? current : undefined;

  useEffect(() => {
    if (!monday) return;
    fetch(`/api/calendar/week?start=${monday}`)
      .then((response) => response.json() as Promise<WeekResponse>)
      .catch((): WeekResponse => ({ state: "error" }))
      // A failed refresh keeps the week already on screen.
      .then((data) => setWeeks((all) => (data.state !== "ok" && all[monday]?.state === "ok" ? all : { ...all, [monday]: data })));
  }, [monday, attempt]);

  // The dialog can open after the grid mounts (straight onto Week), so the first scroll waits for a real size.
  const attach = useCallback((el: HTMLDivElement | null) => {
    scroller.current = el;
    if (!el) return;
    scrolled.current = false;
    // Event boxes pick a time label that fits whole, so they need the column's width and the Mono's digit width.
    const measure = () => {
      const column = el.querySelector<HTMLElement>(".week-day")?.offsetWidth ?? 0;
      const ch = (el.querySelector<HTMLElement>(".week-ch")?.offsetWidth ?? 0) / 10;
      setMetrics((was) => (was.column === column && was.ch === ch ? was : { column, ch }));
    };
    const observer = new ResizeObserver(() => {
      if (el.clientHeight > 0) setVisible(true);
      measure();
    });
    observer.observe(el);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !visible || dates.length === 0) return;
    if (!scrolled.current) {
      // Mornings open at 7 AM; later in the day, this week keeps now in view.
      const hour = today && dates.includes(today) ? Math.floor(wallMinutes(now, today, zone) / 60) - 2 : 0;
      el.scrollTop = Math.max(OPENS_AT, hour) * HOUR;
      scrolled.current = true;
    }
    if (edge.current) {
      const column = el.querySelector<HTMLElement>(".week-day")?.offsetWidth ?? 0;
      const at = { start: 0, end: el.scrollWidth, today: Math.max(0, dates.indexOf(today ?? "")) * column }[edge.current];
      el.scrollLeft = at;
      edge.current = null;
    }
  });

  useLayoutEffect(() => {
    const el = pop.current;
    if (!el || !plan) return;
    if (!el.matches(":popover-open")) el.showPopover();
    openedAt.current = performance.now();
    const { width, height } = el.getBoundingClientRect();
    // Beside the tap, or else above or below it, so the popover never opens under the pointer; clamped as a last resort.
    const left = Math.max(16, Math.min(plan.x + 12, innerWidth - width - 16));
    const top = Math.max(16, Math.min(plan.y - 24, innerHeight - height - 16));
    const fits = ([x, y]: number[]) => x >= 16 && y >= 16 && x + width <= innerWidth - 16 && y + height <= innerHeight - 16;
    const [x, y] = [[plan.x + 12, top], [plan.x - 12 - width, top], [left, plan.y - 12 - height], [left, plan.y + 12]].find(fits) ?? [left, top];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.querySelector<HTMLElement>("button")?.focus();
  }, [plan]);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    // Focus the person moved on purpose (the toolbar, the tabs) stays; focus that was lost, or left in the grid, moves.
    const active = document.activeElement;
    if (active && active.isConnected && active !== document.body && active.tagName !== "DIALOG" && !active.closest(".week-items")) return;
    (status.current?.querySelector<HTMLElement>("button") ?? status.current)?.focus({ preventScroll: true });
  }, [note]);

  // The second click of a double click, or a tap the moment the popover opens, is never a choice.
  const settled = (event: MouseEvent) => event.detail <= 1 && performance.now() - openedAt.current >= SETTLE_MS;

  const days = week?.state === "ok"
    ? week.days.map((day) => {
        const known = new Set(day.events.map((event) => event.id));
        const added = extra.filter((event) => !known.has(event.id) && localDate(zone, new Date(event.start)) === day.date);
        const events: Shown[] = [...day.events, ...added]
          .filter((event) => !undone.includes(event.id))
          .map((event) => (event.id === undoing ? { ...event, status: "undoing" } : event));
        return { date: day.date, events };
      })
    : null;

  function go(to: string | null, scrollTo: "start" | "end" | "today") {
    edge.current = scrollTo;
    setPicked(to);
    closePlan();
  }

  // Phones and tablets step a day at a time inside the week, then into the next; the full grid steps whole weeks.
  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el || !monday) return;
    closePlan();
    const column = el.querySelector<HTMLElement>(".week-day")?.offsetWidth ?? 0;
    const room = direction < 0 ? el.scrollLeft : el.scrollWidth - el.clientWidth - el.scrollLeft;
    if (column && room > column / 2) el.scrollBy({ left: direction * column, behavior: motion() });
    else go(addDays(monday, direction * 7), direction < 0 ? "end" : "start");
  }

  function openPlan(event: MouseEvent<HTMLElement>, target: Target) {
    const box = event.currentTarget.getBoundingClientRect();
    const keyboard = event.detail === 0; // Enter or Space: no pointer position
    invoker.current = event.currentTarget;
    setPlan({ ...target, x: keyboard ? box.left : event.clientX, y: keyboard ? box.top + 24 : event.clientY });
  }

  function closePlan() {
    if (pop.current?.matches(":popover-open")) pop.current.hidePopover();
  }

  async function book(block: CalendarBlock, date: string, start: number, stepId?: string) {
    if (busyRef.current || !block.start || !block.end) return;
    busyRef.current = true;
    setBusy(true);
    closePlan();
    const pending: Shown = { id: `booking:${block.start}`, title: block.title, start: block.start, end: block.end, allDay: false, zeno: true, color: null, status: "booking" };
    setExtra((all) => [...all, pending]);
    setNote(null);
    let answer: BookResponse = { state: "error" };
    try {
      const response = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: [block] }),
      });
      answer = (await response.json()) as BookResponse;
    } catch {
      // Offline or an unreadable answer: nothing is claimed as booked.
    }
    refocus.current = true;
    const booked = answer.state === "ok" ? answer.booked.find((b) => b.eventId && b.start && b.end) : undefined;
    if (booked?.eventId && booked.start && booked.end) {
      const event: WeekEvent = { id: booked.eventId, title: booked.title, start: booked.start, end: booked.end, allDay: false, zeno: true, color: null };
      setExtra((all) => all.map((e) => (e.id === pending.id ? event : e)));
      setMine((all) => ({ ...all, [event.id]: stepId ?? "" }));
      const streak = Boolean(stepId) && today !== null && date === addDays(today, 1);
      const when = `${dayWord(date, today ?? date)} at ${formatTime(new Date(instantAt(date, start, zone)), zone)}`;
      setNote({
        text: streak ? "Booked. Tomorrow's streak is planned." : `Booked for ${when}.`,
        about: streak ? `${booked.title}, ${when}` : booked.title,
        undo: event,
      });
      onBooked?.({ event, stepId });
    } else {
      setExtra((all) => all.filter((e) => e.id !== pending.id));
      if (answer.state === "needs-permission") setWriteLost(true);
      setNote(
        answer.state === "needs-permission"
          ? { text: "Zeno needs your OK to add to its calendar first." }
          : answer.state === "no-access" || answer.state === "signed-out"
            ? { text: "Zeno can't reach your calendar right now.", signIn: "Connect your calendar" }
            : { text: "I couldn't book that just now. Try again?" },
      );
    }
    busyRef.current = false;
    setBusy(false);
  }

  async function undo(event: WeekEvent) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    closePlan();
    setUndoing(event.id);
    setNote(null);
    let state: BookResponse["state"] = "error";
    try {
      const response = await fetch(`/api/calendar/book/${encodeURIComponent(event.id)}`, { method: "DELETE" });
      state = ((await response.json()) as BookResponse).state;
    } catch {
      // Offline: the block stays, and the line says so.
    }
    refocus.current = true;
    setUndoing(null);
    if (state === "ok") {
      setUndone((ids) => [...ids, event.id]);
      setMine((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== event.id)));
      setNote({ text: "Taken off your calendar.", about: event.title });
      onBooked?.({ event, stepId: mine[event.id] || undefined, undone: true });
    } else {
      setNote({ text: "I couldn't undo that just now. Try again?", undo: event });
    }
    busyRef.current = false;
    setBusy(false);
  }

  if (week && week.state !== "ok") {
    const noAccess = week.state === "no-access" || week.state === "signed-out";
    return (
      <div className="flex flex-col items-start gap-4">
        <section className="mini self-stretch">
          <ul className="lines">
            <li>{noAccess ? "Zeno can't see your calendar right now." : "Zeno couldn't read your calendar just now."}</li>
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

  return (
    <>
      {/* The status line always has its own space (beside the week on a laptop, its own row below), so a booking's
          line never moves the arrows under the pointer or the grid under the hand. */}
      <div className="week-bar">
        <h2 className="text-[20px] font-bold">
          <span className="sr-only">Week of </span>
          {monday ? weekLabel(monday) : "This week"}
        </h2>
        <div ref={status} role="status" tabIndex={-1} className="week-status">
          {!days && <p className="sr-only">Loading your week…</p>}
          {empty && !note && (
            <p className="text-ink-2">
              {canBook ? "Your week is wide open. Tap any open time to plan a step." : "Nothing on your calendar this week."}
            </p>
          )}
          {note && (
            <p>
              {note.about && <span className="sr-only">{note.about}: </span>}
              {note.text}
            </p>
          )}
          {note?.undo && (
            <button type="button" aria-disabled={busy} onClick={() => note.undo && void undo(note.undo)} className="pill pill-small">
              Undo
            </button>
          )}
          {note?.signIn && (
            <button type="button" onClick={onSignIn} className="pill pill-small">
              {note.signIn}
            </button>
          )}
        </div>
        <div className="week-nav">
          {monday && thisWeek && monday !== thisWeek && (
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

      {needsPermission && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p>Zeno can see your week. To plan in it, Zeno adds blocks to its own calendar.</p>
          <button type="button" onClick={onSignIn} className="pill pill-small pill-ink">
            Let Zeno add to your calendar
          </button>
        </div>
      )}

      <div ref={attach} className="week-scroll" aria-busy={!days || undefined}>
        <div className="week-sheet" style={{ "--hour": `${HOUR}px` } as CSSProperties}>
          <div className="week-corner" aria-hidden="true">
            <span className="week-ch font-mono">0000000000</span>
          </div>
          <div className="week-hours" aria-hidden="true">
            {HOURS.map((hour) => (
              <span key={hour} style={{ top: hour * HOUR }}>
                {clockLabel(hour)}
              </span>
            ))}
          </div>
          {dates.map((date, index) => {
            const events = days?.[index]?.events ?? [];
            const placed = layoutDay(events, date, zone, MIN_MINUTES);
            const from = canBook && today ? planFrom(date, today, nowMinutes) : null;
            // Open time starts below a short event's drawn box, never under it.
            const drawn = placed.map((box) => ({ top: box.top, bottom: Math.max(box.bottom, box.top + MIN_MINUTES) }));
            const gaps = from === null ? [] : freeGaps(drawn, from, PLAN_HOURS.to);
            // Reading order: the day, its all-day chips, then events and open time by start.
            const items = [...placed.map((box) => ({ top: box.top, box })), ...gaps.map((gap) => ({ top: gap.top, gap }))].sort(
              (a, b) => a.top - b.top,
            );
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
                        .map((event, i) => (
                          <li
                            key={`${event.id}:${i}`}
                            className="week-chip"
                            data-zeno={event.zeno || undefined}
                            style={{ "--cal": event.color ?? "var(--ink-2)" } as CSSProperties}
                            title={event.title}
                          >
                            <span className="sr-only">All day{event.zeno ? ", Zeno" : ""}: </span>
                            {event.title}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="week-body">
                  {!days && SKELETON.filter(([day]) => day === index).map(([, hour, hours]) => (
                    <div key={hour} className="week-skeleton" aria-hidden="true" style={{ top: hour * HOUR, height: hours * HOUR - 2 }} />
                  ))}
                  <ol className="week-items">
                    {items.map((item, i) =>
                      "box" in item && item.box ? (
                        <EventBox
                          key={`${item.box.event.id}:${item.box.top}:${i}`}
                          box={item.box}
                          zone={zone}
                          metrics={metrics}
                          // Text stops where the first event cascaded over this one starts, so nothing peeks out under it.
                          covered={placed.find((other) => other.indent > item.box.indent && other.top >= item.box.top && other.top < item.box.bottom)?.top}
                          past={Boolean(today && (date < today || (isToday && item.box.bottom <= nowMinutes)))}
                          onUndo={
                            item.box.event.id in mine && !item.box.event.status
                              ? (event) => openPlan(event, { kind: "undo", event: item.box.event })
                              : undefined
                          }
                        />
                      ) : "gap" in item && item.gap ? (
                        <OpenTime
                          key={`gap:${item.gap.top}`}
                          gap={item.gap}
                          label={timeRange(instantAt(date, item.gap.top, zone), instantAt(date, item.gap.bottom, zone), zone)}
                          ghost={ghost?.date === date && ghost.at >= item.gap.top - 15 && ghost.at < item.gap.bottom ? ghost.at : null}
                          onHover={(at) => setGhost(at === null ? null : { date, at })}
                          onOpen={(event, at) => openPlan(event, { kind: "book", date, gap: item.gap, at })}
                        />
                      ) : null,
                    )}
                    {days && items.length === 0 && <li className="sr-only">Nothing planned.</li>}
                  </ol>
                  {isToday && <div className="week-now" aria-hidden="true" style={{ top: px(nowMinutes) }} />}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div
        ref={pop}
        popover="auto"
        className="week-pop"
        onToggle={(event) => {
          if (event.newState !== "closed" || event.currentTarget.matches(":popover-open")) return;
          setPlan(null);
          // Esc or Not now: back to the open time that was tapped.
          const active = document.activeElement;
          const lost = !active || active === document.body || active.tagName === "DIALOG";
          // A booked or undone block replaces what was tapped; the status line takes focus when that settles.
          if (lost && invoker.current?.isConnected) invoker.current.focus({ preventScroll: true });
        }}
      >
        {plan?.kind === "book" && (
          <PlanCard
            plan={plan}
            zone={zone}
            step={step}
            goal={goal}
            busy={busy}
            onBook={(event, block, start, stepId) => {
              if (settled(event)) void book(block, plan.date, start, stepId);
            }}
            onClose={closePlan}
          />
        )}
        {plan?.kind === "undo" && (
          <>
            <p className="text-[20px] leading-8 font-bold">{plan.event.title}</p>
            <p className="font-mono text-ink-2">{timeRange(plan.event.start, plan.event.end, zone)}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                aria-disabled={busy}
                onClick={(event) => {
                  if (settled(event)) void undo(plan.event);
                }}
                className="pill pill-ink"
              >
                Undo booking
              </button>
              <button type="button" onClick={closePlan} className="pill pill-quiet">
                Keep it
              </button>
            </div>
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

type Box = { event: Shown; top: number; bottom: number; col: number; cols: number; indent: number };

type EventBoxProps = {
  box: Box;
  zone: string;
  metrics: Metrics;
  covered?: number; // where an event drawn over this one starts
  past: boolean;
  onUndo?: (event: MouseEvent<HTMLElement>) => void;
};

function EventBox({ box, zone, metrics, covered, past, onUndo }: EventBoxProps) {
  const { event } = box;
  const height = Math.max(MIN_BOX, px(box.bottom - box.top)) - 2;
  // Room for the title's lines, plus one for the time when the box is tall, above anything cascaded over it.
  const lines = Math.max(1, Math.floor((Math.min(height, covered === undefined ? height : px(covered - box.top)) - 4) / 24));
  const status = event.status === "booking" ? "Booking…" : event.status === "undoing" ? "Taking it off…" : null;
  const range = timeRange(event.start, event.end, zone);
  const indent = box.indent * INDENT;
  // The text's width: the box's share of the column, less its 2px margin, 4px gap and 18px of padding.
  const room = (metrics.column - 1 - indent) / box.cols - 24;
  // A time is shown whole or not at all: the range, else the start ("8:00 AM", then "8:00").
  const start = formatTime(new Date(event.start), zone);
  const time = metrics.ch > 0 ? [range, start, start.replace(/\s*[AP]M$/, "")].find((label) => label.length * metrics.ch <= room) : undefined;
  // In a narrow box the title keeps to one line and ends in an ellipsis, never breaking a word.
  const narrow = room < 88;
  const titleLines = narrow ? 1 : lines > 1 ? lines - 1 : 1;
  const body = (
    <>
      {event.zeno && <span className="sr-only">Zeno block: </span>}
      <span className="week-title" data-narrow={narrow || undefined} style={{ "--lines": titleLines } as CSSProperties}>
        {/* A block too short for two lines says Booking… in place of its title, which screen readers still hear. */}
        {status && lines < 2 && <span aria-hidden="true">{status}</span>}
        <span className={status && lines < 2 ? "sr-only" : undefined}>{event.title}</span>
      </span>
      {lines > 1 && (status || time) && (
        <span className="week-time font-mono" aria-hidden="true">
          {status ?? time}
        </span>
      )}
      <span className="sr-only">, {status ?? range}</span>
      {onUndo && <span className="sr-only">. Booked just now; open to undo.</span>}
    </>
  );
  return (
    <li
      className="week-event"
      data-zeno={event.zeno || undefined}
      data-status={event.status}
      data-past={past || undefined}
      title={`${event.title}, ${range}`}
      style={
        {
          top: px(box.top),
          height,
          // Cascaded events start one indent in per level, and share what's left with any that start with them.
          left: `calc(${indent}px + (100% - ${indent}px) * ${box.col / box.cols})`,
          width: `calc((100% - ${indent}px) / ${box.cols} - 4px)`,
          "--cal": event.color ?? "var(--ink-2)",
        } as CSSProperties
      }
    >
      {onUndo ? (
        <button type="button" onClick={onUndo} className="week-event-tap">
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}

type OpenTimeProps = {
  gap: Gap;
  label: string;
  ghost: number | null;
  onHover(at: number | null): void;
  onOpen(event: MouseEvent<HTMLElement>, at: number): void;
};

// Open time is one quiet button; a mouse shows where a half-hour block would land, a tap or Enter opens Plan here.
function OpenTime({ gap, label, ghost, onHover, onOpen }: OpenTimeProps) {
  const minuteAt = (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) =>
    gap.top + ((event.clientY - event.currentTarget.getBoundingClientRect().top) / HOUR) * 60;
  const length = Math.min(FOCUS_MINUTES, gap.bottom - gap.top);
  const shown = ghost === null ? null : planStart(gap, ghost, length);
  return (
    <li className="week-open" style={{ top: px(gap.top), height: px(gap.bottom - gap.top) }}>
      <button
        type="button"
        aria-label={`Open ${label}. Plan here`}
        className="week-gap"
        onClick={(event) => onOpen(event, event.detail === 0 ? gap.top : minuteAt(event))}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const at = Math.floor(minuteAt(event) / 15) * 15;
          if (at !== ghost) onHover(at);
        }}
        onPointerLeave={() => onHover(null)}
      >
        {shown !== null && (
          <span className="week-ghost" style={{ top: px(shown - gap.top), height: px(length) - 2 }}>
            Plan here
          </span>
        )}
      </button>
    </li>
  );
}

type PlanCardProps = {
  plan: Extract<Plan, { kind: "book" }>;
  zone: string;
  step: Goal["steps"][number] | undefined;
  goal: Goal | null;
  busy: boolean;
  onBook(event: MouseEvent, block: CalendarBlock, start: number, stepId?: string): void;
  onClose(): void;
};

// Plan here: the current step if it fits, or a focus block (30 minutes, or what the gap holds).
function PlanCard({ plan, zone, step, goal, busy, onBook, onClose }: PlanCardProps) {
  const room = plan.gap.bottom - plan.gap.top;
  const stepMinutes = Math.min(240, Math.max(1, step?.minutes ?? FOCUS_MINUTES));
  const stepFits = step && stepMinutes <= room;
  const focusMinutes = Math.min(FOCUS_MINUTES, room);
  const start = planStart(plan.gap, plan.at, Math.max(focusMinutes, stepFits ? stepMinutes : 0));
  const iso = (minutes: number) => new Date(instantAt(plan.date, minutes, zone)).toISOString();
  const block = (title: string, minutes: number, stepId?: string): CalendarBlock => ({
    title: title.slice(0, 120),
    kind: "step",
    start: iso(start),
    end: iso(start + minutes),
    // A draft goal's steps have no saved id yet, and booking accepts only saved ones.
    ...(stepId && !stepId.startsWith("draft") ? { stepId } : {}),
  });
  return (
    <>
      <p className="text-[20px] leading-8 font-bold">Plan here</p>
      <p className="text-ink-2">
        {dateLabel(plan.date, { weekday: "long", month: "short", day: "numeric" })} at{" "}
        <span className="font-mono">{formatTime(new Date(instantAt(plan.date, start, zone)), zone)}</span>
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {stepFits && (
          <button
            type="button"
            aria-disabled={busy}
            onClick={(event) => onBook(event, block(step.title, stepMinutes, step.id), start, step.id)}
            className="pill pill-ink week-choice"
          >
            {/* The step is read in full before it is booked, so its title wraps instead of clipping. */}
            <span className="min-w-0">{step.title}</span>
            <span className="shrink-0 font-mono font-normal">{stepMinutes} min</span>
          </button>
        )}
        <button
          type="button"
          aria-disabled={busy}
          onClick={(event) => onBook(event, block(goal ? `Focus: ${goal.title}` : "Focus time", focusMinutes), start)}
          className={`pill week-choice ${stepFits ? "" : "pill-ink"}`}
        >
          <span className="min-w-0">Focus block</span>
          <span className="shrink-0 font-mono font-normal">{focusMinutes} min</span>
        </button>
        <button type="button" onClick={onClose} className="pill pill-quiet">
          Not now
        </button>
      </div>
    </>
  );
}
