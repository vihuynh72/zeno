"use client";

import { type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DayEmail, DayEvent, Deadline, Goal, MailResponse, Progress, SourceState } from "@/lib/day";
import type { Today } from "@/components/day-view";
import { browserZone, freeGaps, httpsOnly, markEvents, senderName, snippetLine, timeRange } from "@/components/desk-rows";
import { deskPlans, doneCaption, dueShort, sameGoal } from "@/components/goal-rows";
import WeekGoals, { GoalLines } from "@/components/week-goals";
import WeekGrid from "@/components/week-grid";
import { formatTime, localDate } from "@/lib/tz";

// An open email's own rules scroll with its words, on card stock so the card's fixed rules don't show through.
const RULED: CSSProperties = {
  background: "linear-gradient(var(--rule) 1px, transparent 1px) 0 calc(var(--lh) / 2 + var(--fs) * var(--k)) / 100% var(--lh) local, var(--card)",
};

const SOURCE_NOTE: Record<Exclude<SourceState, "ok">, (name: string) => string> = {
  "no-access": (name) => `Zeno can't see your ${name} right now. Sign in again to allow it.`,
  error: (name) => `Zeno couldn't read your ${name} just now.`,
  "not-configured": (name) => `Your ${name} isn't connected yet.`,
};

const everyHalfMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
};

const time = (event: DayEvent) => (event.allDay ? "All day" : formatTime(event.start, browserZone()));

type DeskTab = "today" | "week";
const TABS: Record<DeskTab, string> = { today: "Today", week: "Week" };

// tab is the view it opens on; the person switches between Today and Week inside. booked is what the card booked since
// the day loaded, which Today shows. Nothing here writes to the calendar.
type DeskProps = {
  open: boolean;
  tab?: DeskTab;
  today: Today | null;
  goal: Goal | null;
  booked?: DayEvent[];
  onClose(): void;
  onSignIn(): void;
  // The working cards (Vi, Nov 3): every open plan, this week's days for the Week, and taps that leave the Desk for a
  // plan's desk, a deadline's new plan, or an email's reply.
  goals?: Goal[];
  progress?: Progress;
  onGoal?(goalId: string): void;
  onDeadline?(deadline: Deadline): void;
  onReply?(email: DayEmail): void;
};

// Only the backdrop: a click on the dialog's own scrollbar lands inside its box.
function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  return event.target === event.currentTarget && outside;
}

// The Desk, unfolded from the card: Today's working cards (goals, mail, deadlines, the day) and the Week's goals.
export default function Desk({ open, onClose, ...rest }: DeskProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // The guided card's box, read before the dialog covers it.
      const from = document.querySelector("main .card:not(.leaving)")?.getBoundingClientRect();
      // Opens from the card's top edge, so the top bar and the four steps above stay whole.
      dialog.style.setProperty("--top", from ? `${Math.max(32, from.top)}px` : "");
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
      unfold(dialog, from);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Desk"
      className="desk"
      // Every way out (Esc, Close, the backdrop) closes the dialog itself, which tells the page here.
      onClose={onClose}
      onPointerDown={(event) => {
        downOnBackdrop.current = onBackdrop(event);
      }}
      onClick={(event) => {
        // Down and up both: a text selection dragged out past the edge also ends in a click on the dialog.
        if (downOnBackdrop.current && onBackdrop(event)) event.currentTarget.close();
      }}
    >
      {open && <DeskBody {...rest} />}
    </dialog>
  );
}

// Opens out of the card's box with a calm clip and scale; reduced motion (or no card on screen) gets a fade.
function unfold(dialog: HTMLDialogElement, from: DOMRect | undefined) {
  if (!from?.width || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    return;
  }
  const box = dialog.getBoundingClientRect();
  const inset = [from.top - box.top, box.right - from.right, box.bottom - from.bottom, from.left - box.left]
    .map((n) => `${Math.max(0, n)}px`)
    .join(" ");
  dialog.animate(
    [
      { clipPath: `inset(${inset} round 4px)`, transform: "scale(0.98)" },
      // Ends outside the box so the paper shadow is already showing when the clip lets go.
      { clipPath: "inset(-64px round 8px)", transform: "none" },
    ],
    { duration: 300, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
  );
  // Only the words fade in, never the paper (the page would show through), so the card hands over softly.
  dialog.firstElementChild?.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
}

function DeskBody({ tab: opensOn = "today", today, goal, goals, progress, onSignIn, onGoal, onDeadline, onReply, booked = [] }: Omit<DeskProps, "open" | "onClose">) {
  // Wall clock to the minute; 0 on the server, so nothing is marked before the browser knows the time.
  const now = useSyncExternalStore(everyHalfMinute, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
  const [tab, setTab] = useState(opensOn);
  const [view, setView] = useState<"goals" | "calendar">("goals"); // the Week's two views
  const noAccess = today && (today.sources.calendar === "no-access" || today.sources.email === "no-access");
  const plans = deskPlans(goal, goals);
  const deadlines = today?.sources.calendar === "ok" ? (today.deadlines ?? []) : [];
  const date = now ? localDate(browserZone(), new Date(now)) : "";
  const grid = tab === "week" && view === "calendar";

  // Arrow keys move between the two views, as a tab list does.
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "today" : event.key === "End" ? "week" : tab === "today" ? "week" : "today";
    setTab(next);
    document.getElementById(`desk-tab-${next}`)?.focus();
  }

  return (
    // Fills the dialog, so a click inside never reads as a backdrop click.
    <div className={`wrap-break-word ${grid ? "flex h-full flex-col" : "min-h-full"}`} data-view={tab}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-desk px-4 pt-6 pb-4 sm:px-8">
        <div role="tablist" aria-label="Desk" className="flex gap-6" onKeyDown={onTabKey}>
          {(Object.keys(TABS) as DeskTab[]).map((name) => (
            <button
              key={name}
              id={`desk-tab-${name}`}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls={`desk-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              className="desk-tab"
            >
              {TABS[name]}
            </button>
          ))}
        </div>
        <button type="button" onClick={(event) => event.currentTarget.closest("dialog")?.close()} className="pill pill-small">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Close
        </button>
      </div>

      {tab === "week" ? (
        <div
          id="desk-week"
          role="tabpanel"
          aria-labelledby="desk-tab-week"
          className={`flex flex-col gap-4 px-4 sm:px-8 ${grid ? "min-h-0 flex-1 pb-4 sm:pb-8" : "pb-8"}`}
        >
          {/* Goals across the week first (Vi, Nov 3); the calendar grid one tap away. */}
          <div className="-ml-1 flex items-center gap-2 text-ink-2">
            <button type="button" onClick={() => setView("goals")} aria-pressed={!grid} data-lead={!grid || undefined} className="link">
              Goals
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setView("calendar")} aria-pressed={grid} data-lead={grid || undefined} className="link">
              Calendar
            </button>
          </div>
          {grid ? (
            <WeekGrid now={now} onSignIn={onSignIn} />
          ) : (
            <WeekGoals now={now} goals={plans} deadlines={deadlines} progress={progress} onGoal={onGoal} onDeadline={onDeadline} />
          )}
        </div>
      ) : (
        <div id="desk-today" role="tabpanel" aria-labelledby="desk-tab-today" className="flex flex-col gap-6 px-4 pb-8 sm:px-8">
          <h2 className="sr-only">Today</h2>
          {/* Goals, Mail, Deadlines, Today (Vi, Nov 3): one column on phones; on a laptop the mail takes the right side. */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr]">
            <Goals plans={plans} date={date} hint={deadlines.length > 0} onGoal={onGoal} />
            {today && <Mail today={today} onReply={onReply} />}
            {deadlines.length > 0 && <Deadlines deadlines={deadlines} plans={plans} onGoal={onGoal} onDeadline={onDeadline} />}
            {today && <Calendar today={today} now={now} booked={booked} />}
          </div>
          {!today && <p className="text-ink-2">I couldn&apos;t load today just now. Reload the page to try again.</p>}
          {noAccess && (
            <button type="button" onClick={onSignIn} className="pill pill-small self-start">
              Sign in again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Every open plan, each row one tap into that plan's desk.
function Goals({ plans, date, hint, onGoal }: { plans: Goal[]; date: string; hint: boolean; onGoal?(goalId: string): void }) {
  return (
    <section className="mini lg:col-start-1">
      <h3 className="text-[20px] leading-8 font-bold">Goals</h3>
      <ul className="lines mt-2">
        {plans.length === 0 ? (
          <li className="text-ink-2">No plans yet.{hint && " Pick a deadline below."}</li>
        ) : (
          plans.map((plan) => (
            <li key={plan.id}>
              <button type="button" onClick={() => onGoal?.(plan.id)} className="group block w-full text-left active:opacity-60">
                <GoalLines title={plan.title} bold aside={plan.due && date ? dueShort(plan.due, date) : undefined} goal={plan} caption={doneCaption(plan)} />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function Calendar({ today, now, booked }: { today: Today; now: number; booked: DayEvent[] }) {
  const { calendar } = today.sources;
  const zone = browserZone();
  // Today's blocks booked from the card join the list, in time order after the all-day ones.
  const added = booked.filter((event) => now && localDate(zone, new Date(event.start)) === localDate(zone, new Date(now)));
  const events = added.length
    ? [...today.events, ...added].sort((a, b) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.start) - Date.parse(b.start))
    : today.events;
  const marks = now ? markEvents(events, now) : [];
  // The rest of today's open time worth a step, soonest first: from now on, less what was just booked.
  const busy = added.map((event) => ({ top: Date.parse(event.start), bottom: Date.parse(event.end) }));
  const free = (today.free ?? [])
    .flatMap((slot) => freeGaps(busy, Math.max(Date.parse(slot.start), now), Date.parse(slot.end), 15 * 60_000))
    .slice(0, 3);
  return (
    <section className="mini lg:col-start-1">
      <h3 className="text-[20px] leading-8 font-bold">
        {now ? new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Calendar"}
      </h3>
      <ul className="lines mt-2">
        {calendar !== "ok" ? (
          <li className="text-ink-2">{SOURCE_NOTE[calendar]("calendar")}</li>
        ) : events.length === 0 ? (
          <li className="text-ink-2">Nothing on your calendar today.</li>
        ) : (
          events.map((event, i) => {
            const mark = marks[i];
            const marked = mark === "now" || mark === "next";
            return (
              <li
                key={`${event.start}:${event.title}:${i}`}
                data-mark={mark ?? undefined}
                className={`flex items-baseline gap-4 ${mark === "past" ? "text-ink-2" : ""}`}
              >
                <span className="w-[8ch] shrink-0 font-mono leading-none whitespace-nowrap text-ink-2">
                  {time(event)}
                </span>
                {/* Zeno's own blocks carry a red margin mark, as they do on the week. */}
                <span className={`min-w-0 flex-1 ${marked ? "font-bold" : ""} ${event.zeno ? "border-l-2 border-margin pl-2" : ""}`}>
                  {event.zeno && <span className="sr-only">Zeno block: </span>}
                  {event.title}
                </span>
                {marked && <span className="shrink-0">{mark === "now" ? "Now" : "Next"}</span>}
              </li>
            );
          })
        )}
        {calendar === "ok" && free.length > 0 && (
          <li className="text-ink-2">
            Free{" "}
            {free.map((slot, i) => (
              <span key={slot.top}>
                {i > 0 && ", "}
                <span className="font-mono whitespace-nowrap">{timeRange(slot.top, slot.bottom, zone)}</span>
              </span>
            ))}
          </li>
        )}
      </ul>
    </section>
  );
}

// A deadline with a plan shows that plan's bar and opens it; one without plans it (onDeadline).
function Deadlines({ deadlines, plans, onGoal, onDeadline }: { deadlines: Deadline[]; plans: Goal[]; onGoal?(goalId: string): void; onDeadline?(deadline: Deadline): void }) {
  return (
    <section className="mini lg:col-start-1">
      <h3 className="text-[20px] leading-8 font-bold">Deadlines</h3>
      <ul className="lines mt-2">
        {deadlines.slice(0, 5).map((deadline, i) => {
          const plan = plans.find((p) => sameGoal(p.title, deadline.title));
          const when = deadline.daysLeft === 0 ? "Due today" : deadline.daysLeft === 1 ? "Tomorrow" : `in ${deadline.daysLeft} days`;
          return (
            <li key={`${deadline.date}:${deadline.title}:${i}`}>
              <button
                type="button"
                onClick={() => (plan ? onGoal?.(plan.id) : onDeadline?.(deadline))}
                className="group block w-full text-left active:opacity-60"
              >
                <GoalLines title={deadline.title} bold={deadline.daysLeft === 0} aside={when} goal={plan} caption={plan ? doneCaption(plan) : "Not started"} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Only important mail reaches the desk, mail that asks her something first (Vi, Nov 3). A tap opens one email in place,
// read in full from Gmail; its text lives only in this card's state, never stored or logged.
function Mail({ today, onReply }: { today: Today; onReply?(email: DayEmail): void }) {
  const { email } = today.sources;
  const gmail = httpsOnly(today.mailUrl)?.split("#")[0];
  const list = [...today.emails.filter((mail) => mail.asks), ...today.emails.filter((mail) => !mail.asks)].slice(0, 6);
  const asking = list.filter((mail) => mail.asks);
  const other = list.filter((mail) => !mail.asks);
  const [open, setOpen] = useState<string | null>(null);
  const [read, setRead] = useState<{ id: string; mail: MailResponse } | null>(null);

  useEffect(() => {
    if (!open) return;
    const stop = new AbortController();
    // no-store: the browser's HTTP cache never keeps the text either.
    fetch(`/api/mail/${encodeURIComponent(open)}`, { signal: stop.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<MailResponse>)
      .catch((): MailResponse => ({ state: "error" }))
      .then((mail) => {
        if (!stop.signal.aborted) setRead({ id: open, mail });
      });
    return () => stop.abort();
  }, [open]);

  // One email open at a time; closing one drops its text.
  function toggle(id: string) {
    setRead(null);
    setOpen((was) => (was === id ? null : id));
  }

  const row = (mail: DayEmail, i: number) => {
    const { id } = mail;
    const snippet = mail.asks ? snippetLine(mail.snippet) : "";
    const head = (
      <>
        <span className={`block truncate max-sm:line-clamp-2 max-sm:whitespace-normal ${mail.unread ? "font-bold" : ""}`}>
          {mail.unread && <span className="sr-only">Unread: </span>}
          {senderName(mail.from)}
          <span className="px-2 font-normal text-ink-2" aria-hidden="true">
            ·
          </span>
          <span className="sr-only">: </span>
          <span className="underline-offset-4 group-hover:underline">{mail.subject}</span>
        </span>
        {snippet && (
          <span className="block truncate text-ink-2">
            <span className="sr-only">: </span>
            {snippet}
          </span>
        )}
      </>
    );
    // A row from a day saved before Nov 3 has no id, so it doesn't open.
    if (!id) return <li key={`${i}:${mail.from}:${mail.subject}`}>{head}</li>;
    const shown = open === id && read?.id === id ? read.mail : null;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={open === id}
          aria-controls={open === id ? `mail-${id}` : undefined}
          className="group block w-full text-left active:opacity-60"
        >
          {head}
        </button>
        {open === id && (
          <div id={`mail-${id}`}>
            {!shown ? (
              <p className="text-ink-2">Opening the email…</p>
            ) : shown.state !== "ok" ? (
              <p className="text-ink-2">Couldn&apos;t open it.</p>
            ) : shown.text.trim() ? (
              // About 280px of the email at a time, its paragraphs kept, scrolling inside the card.
              <div
                role="region"
                aria-label={`Email from ${senderName(mail.from)}`}
                tabIndex={0}
                className="max-h-72 overflow-y-auto overscroll-contain whitespace-pre-line"
                style={RULED}
              >
                {shown.text.trim()}
              </div>
            ) : (
              <p className="text-ink-2">This email has no text.</p>
            )}
            <p className="flex flex-wrap gap-x-4">
              <button type="button" onClick={() => onReply?.(mail)} className={`underline underline-offset-4 ${mail.asks ? "font-bold" : "text-ink-2"}`}>
                Reply
              </button>
              {gmail && (
                <a href={`${gmail}#inbox/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline underline-offset-4">
                  Open in Gmail
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </p>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="mini lg:col-start-2 lg:row-span-3 lg:row-start-1">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[20px] leading-8 font-bold">Mail</h3>
        {email === "ok" && today.unreadEmail > 0 && (
          <p className="text-ink-2">
            <span className="font-mono">{today.unreadEmail}</span> unread
          </p>
        )}
      </div>
      <div className="lines mt-2">
        {email !== "ok" ? (
          <p className="text-ink-2">{SOURCE_NOTE[email]("inbox")}</p>
        ) : list.length === 0 ? (
          <p className="text-ink-2">Nothing important in your inbox.</p>
        ) : (
          <>
            {asking.length > 0 && (
              <>
                <h4 className="font-bold text-ink-2">Asks you</h4>
                <ul>{asking.map(row)}</ul>
              </>
            )}
            {other.length > 0 && (
              <>
                {asking.length > 0 && <h4 className="font-bold text-ink-2">Other mail</h4>}
                <ul>{other.map(row)}</ul>
              </>
            )}
          </>
        )}
        {gmail && (
          <p>
            <a href={gmail} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline underline-offset-4">
              Open Gmail
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
