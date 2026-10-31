"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DayEvent, Goal, SourceState, Step } from "@/lib/day";
import type { Today } from "@/components/day-view";
import { markEvents, senderName, unescapeHtml } from "@/components/desk-rows";

const STATUS: Record<Step["status"], string> = { done: "Done", doing: "Doing", todo: "To do", skipped: "Skipped" };

// A step's bar on the roadmap strip: done in ink, the one in progress in margin red.
const BAR: Record<Step["status"], string> = {
  done: "border-ink text-ink-2 line-through",
  doing: "border-margin font-bold",
  todo: "border-track",
  skipped: "border-track text-ink-2 line-through",
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

const time = (event: DayEvent) =>
  event.allDay ? "All day" : new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

type DeskProps = { open: boolean; today: Today | null; goal: Goal | null; onClose(): void; onSignIn(): void };

// Today's calendar and inbox in one wide view, unfolded from the card: the seed of the workstation.
export default function Desk({ open, onClose, ...rest }: DeskProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // The guided card's box, read before the dialog covers it.
      const from = document.querySelector("main .card:not(.leaving)")?.getBoundingClientRect();
      // Opens from the card's top edge, so the top bar and the four steps above stay whole.
      dialog.style.setProperty("--top", from ? `${Math.max(32, from.top)}px` : "");
      dialog.showModal();
      dialog.querySelector("h2")?.focus();
      unfold(dialog, from);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Today"
      className="desk"
      // Every way out (Esc, Close, the backdrop) closes the dialog itself, which tells the page here.
      onClose={onClose}
      onClick={(event) => {
        // Only the backdrop: a click on the dialog's own scrollbar lands inside its box.
        const box = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (event.target === event.currentTarget && outside) event.currentTarget.close();
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

function DeskBody({ today, goal, onSignIn }: Omit<DeskProps, "open" | "onClose">) {
  // Wall clock to the minute; 0 on the server, so nothing is marked before the browser knows the time.
  const now = useSyncExternalStore(everyHalfMinute, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
  const noAccess = today && (today.sources.calendar === "no-access" || today.sources.email === "no-access");

  return (
    // Fills the dialog, so a click inside never reads as a backdrop click.
    <div className="min-h-full wrap-break-word">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-desk px-4 pt-6 pb-4 sm:px-8">
        <h2 tabIndex={-1} className="text-[28px] leading-10 font-bold">
          Today
        </h2>
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

      <div className="flex flex-col gap-6 px-4 pb-8 sm:px-8">
        {goal && goal.steps.length > 0 && <Roadmap goal={goal} />}
        {today ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Calendar today={today} now={now} />
            <Inbox today={today} />
          </div>
        ) : (
          <p className="text-ink-2">I couldn&apos;t load today just now. Reload the page to try again.</p>
        )}
        {noAccess && (
          <button type="button" onClick={onSignIn} className="pill pill-small self-start">
            Sign in again
          </button>
        )}
      </div>
    </div>
  );
}

function Roadmap({ goal }: { goal: Goal }) {
  const done = goal.steps.filter((s) => s.status === "done").length;
  const current = goal.steps.find((s) => s.status === "doing") ?? goal.steps.find((s) => s.status === "todo");
  return (
    <section className="mini">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="min-w-0 text-[20px] leading-8 font-bold">{goal.title}</h3>
        <p className="shrink-0 text-ink-2">
          <span className="font-mono">{done}</span> of <span className="font-mono">{goal.steps.length}</span> done
        </p>
      </div>
      <ol className="mt-2 grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${goal.steps.length}, minmax(0, 1fr))` }}>
        {goal.steps.map((s) => (
          <li key={s.id} className={`border-t-4 pt-2 ${BAR[s.status]}`}>
            <span className="sr-only">{STATUS[s.status]}: </span>
            {/* Phones show only the bars here, and the current step on its own line below. */}
            <span className="block truncate max-sm:sr-only" title={s.title}>
              {s.title}
            </span>
          </li>
        ))}
      </ol>
      {current && (
        <p className="sm:hidden" aria-hidden="true">
          {current.status === "doing" ? "Now" : "Next"}: {current.title}
        </p>
      )}
    </section>
  );
}

function Calendar({ today, now }: { today: Today; now: number }) {
  const { calendar } = today.sources;
  const marks = now ? markEvents(today.events, now) : [];
  return (
    <section className="mini">
      <h3 className="text-[20px] leading-8 font-bold">
        {now ? new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Calendar"}
      </h3>
      <ul className="lines mt-2">
        {calendar !== "ok" ? (
          <li className="text-ink-2">{SOURCE_NOTE[calendar]("calendar")}</li>
        ) : today.events.length === 0 ? (
          <li className="text-ink-2">Nothing on your calendar today.</li>
        ) : (
          today.events.map((event, i) => {
            const mark = marks[i];
            const marked = mark === "now" || mark === "next";
            return (
              <li
                key={`${event.start}:${event.title}`}
                data-mark={mark ?? undefined}
                className={`flex items-baseline gap-4 ${mark === "past" ? "text-ink-2" : ""}`}
              >
                <span className="w-[8ch] shrink-0 font-mono leading-none whitespace-nowrap text-ink-2">
                  {time(event)}
                </span>
                <span className={`min-w-0 flex-1 ${marked ? "font-bold" : ""}`}>{event.title}</span>
                {marked && <span className="shrink-0">{mark === "now" ? "Now" : "Next"}</span>}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function Inbox({ today }: { today: Today }) {
  const { email } = today.sources;
  return (
    <section className="mini">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[20px] leading-8 font-bold">Inbox</h3>
        {email === "ok" && today.unreadEmail > 0 && (
          <p className="text-ink-2">
            <span className="font-mono">{today.unreadEmail}</span> unread
          </p>
        )}
      </div>
      <ul className="lines mt-2">
        {email !== "ok" ? (
          <li className="text-ink-2">{SOURCE_NOTE[email]("inbox")}</li>
        ) : today.emails.length === 0 ? (
          <li className="text-ink-2">Nothing in your inbox.</li>
        ) : (
          today.emails.slice(0, 8).map((mail, i) => (
            <li key={`${i}:${mail.from}:${mail.subject}`}>
              <p className={`truncate ${mail.unread ? "font-bold" : ""}`}>
                {mail.unread && <span className="sr-only">Unread: </span>}
                {senderName(mail.from)}
                <span className="px-2 font-normal text-ink-2" aria-hidden="true">
                  ·
                </span>
                {mail.subject}
              </p>
              {mail.snippet && <p className="truncate text-ink-2">{unescapeHtml(mail.snippet)}</p>}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
