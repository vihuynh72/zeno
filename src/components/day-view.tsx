"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import type { DayEmail, DayEvent, FirstPick, Goal, Memory, Progress, SourceState, Step } from "@/lib/day";
import { localDate } from "@/lib/tz";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { cardSize, clock, dueLabel, openSteps, STAGE_OF, STAGES, whenLabel, type Fact, type Screen } from "@/components/day-flow";
import AccountMenu from "@/components/account-menu";
import BookingChip, { type Booking } from "@/components/booking-chip";
import Desk from "@/components/desk";
import MemorySheet from "@/components/memory-sheet";
import NotedLines, { type Quiet } from "@/components/noted-line";
import PrepPack from "@/components/prep-pack";
import StreakRow from "@/components/streak-row";
import VoiceRing from "@/components/voice-ring";

export type Sheet = "today" | "memory" | null;

export type Today = {
  events: DayEvent[];
  emails: DayEmail[];
  unreadEmail: number;
  sources: { calendar: SourceState; email: SourceState; goals: SourceState };
};

// A tap-first answer under the card; "ink" is the one to take, "quiet" the way out.
export type Chip = { label: string; tone?: "ink" | "quiet" };

export type DayViewProps = {
  screen: Screen | null; // null until the browser knows whose day it is
  line: string; // Zeno's latest line
  you: string; // the person's words: live while listening, then what they sent
  goal: Goal | null;
  today: Today | null; // null when the day couldn't load
  memories: Memory[] | "loading" | "error";
  sheet: Sheet;
  typing: boolean;
  stamping: boolean; // the focus card is being stamped DONE
  leaving: Step | null; // the finished card on its way to the pile
  note: string | null; // one plain line under the pills
  signInFailed: boolean;
  busy: boolean; // a save is in flight, so the pills wait
  chips: Chip[]; // the answers to tap (on focus, plan and check-in they sit above the pills)
  dots: { at: number; of: number } | null; // setup progress, shown instead of the four steps
  list: Fact[] | null; // what setup learned, each removable
  reading?: string[]; // what setup is still reading ("Reading your notes…")
  pasting: boolean; // the setup card takes pasted notes
  hear: boolean; // the browser held Zeno's voice back until a tap
  progress: Progress | null; // the streak for the top bar and the row after a Done
  pick?: FirstPick | null; // the first card's one thing, on the ready card
  celebrate?: boolean; // a Done just happened: show the streak row
  quiet?: Quiet[]; // Noted, Kept on this device and heads-up lines
  bookings?: Record<string, Booking>; // booking chips by step id
  offers?: Booking[]; // booking chips that answer Zeno's line
  calendarAsk?: boolean; // Zeno may not write to the calendar yet
  timer?: number | null; // the focus timer's minutes when the tap said so ("Start · 5 min")
  device?: VaultFact[]; // this device's private facts, for Memory
  account?: string | null; // the person's initial
  menuOpen?: boolean; // the /preview gallery shows the account menu open
  checkins?: boolean | null; // focus check-ins on or muted; null hides the toggle
  voice: { phase: VoicePhase; levelRef: { current: number }; muted: boolean; supported: boolean; error: VoiceError };
  on: {
    primary(): void;
    secondary(): void;
    chip(index: number): void;
    hear(): void;
    paste(text: string): void;
    talk(): void;
    type(): void;
    closeTyping(): void;
    send(text: string): void;
    sheet(sheet: Sheet): void;
    forget(fact: Fact): void;
    remove(fact: Fact): void;
    add(text: string): void;
    retryMemory(): void;
    book(key: string): void;
    unbook(key: string): void;
    checkins(): void;
    mute(): void;
    signIn(): void;
    signOut(): void;
  };
};

const startLabel = (minutes: number | null | undefined) => (minutes ? `Start · ${minutes} min` : "Start");
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const everySecond = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};

// Wall clock in whole seconds; 0 on the server so the first paint matches.
function useNow() {
  return useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000) * 1000, () => 0);
}

const everyMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

// The person's date as YYYY-MM-DD; "" on the server, so due labels wait for the browser's clock.
function useToday() {
  return useSyncExternalStore(everyMinute, () => localDate(zone()), () => "");
}

export default function DayView(props: DayViewProps) {
  const { screen, goal, voice, on, progress } = props;
  const bookings = props.bookings ?? {};
  const steps = openSteps(goal);
  const top = (screen === "plan" || screen === "focus" || screen === "checkin") && steps[0] ? steps[0] : null;
  const finished = screen === "checkin" && goal !== null && steps.length === 0;
  const pick = screen === "ready" && props.pick ? props.pick : null;
  const lineOnCard = !top && !finished && !pick;
  const cardText = finished ? `You finished ${goal.title}.` : pick ? pick.steps[0].title : lineOnCard ? props.line : top?.title ?? "";
  const doneCount = (goal?.steps.filter((s) => s.status === "done").length ?? 0) - (props.leaving ? 1 : 0);
  const pile = (screen === "plan" || screen === "focus" || screen === "checkin") && doneCount > 0;
  const blocked = voice.error === "blocked";
  const tapFirst = screen === "ready" || screen === "talk" || screen === "setup" || screen === "wrap";
  const labels =
    screen === "signed-out"
      ? ["Sign in with Google"]
      : screen === "plan" && top
        ? [startLabel(top.minutes), "Change the plan"]
        : screen === "focus" && top
          ? ["Done", "I'm stuck"]
          : screen === "checkin"
            ? finished
              ? ["Pick another thing", "Stop for now"]
              : top
                ? [startLabel(top.minutes), "Stop for now"]
                : []
            : [];
  // The first line shows at once; every later one fades in whole, with no word-by-word wait.
  const [firstLine] = useState(props.line);
  const listening = voice.phase === "listening";
  const youHint =
    screen === "talk" && !props.you && !listening && props.chips.length === 0 && !props.offers?.length
      ? voice.supported && !props.note
        ? "Tap Talk or Type to answer."
        : "Tap Type to answer."
      : "";
  const today = useToday();
  const streak = progress?.streak ?? 0;
  const atRisk = Boolean(progress?.atRisk && streak > 0);

  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  const answersKey = `${screen}:${props.dots?.at}:${props.hear}:${[...props.chips.map((c) => c.label), ...labels].join("|")}`;
  useEffect(() => {
    // When the chip or pill someone pressed goes away, keep keyboard focus on the answers that replace it.
    const first = pillsRef.current?.querySelector("button");
    if (!pressed.current || !first) return;
    pressed.current = false;
    if (document.activeElement === document.body) first.focus();
  }, [answersKey]);

  const youLine = props.typing ? (
    <>
      {props.you && (
        <p>
          <span className="hand text-ink-2">{props.you}</span>
        </p>
      )}
      {/* The box comes back with Zeno's reply, so nothing invites a second send while Zeno thinks. */}
      {voice.phase !== "thinking" && (
        <Write
          busy={props.busy}
          onSend={on.send}
          onClose={() => {
            typeRef.current?.focus();
            on.closeTyping();
          }}
        />
      )}
    </>
  ) : props.you || youHint || listening ? (
    <p>
      <span className={`hand text-ink-2 ${listening ? "pen" : ""}`}>{props.you || youHint || "Listening. Tap anywhere to stop."}</span>
    </p>
  ) : null;

  // A step's booking chip (Booked · Undo right after it books), shown until the step is on the calendar.
  const chipFor = (step: Step) => {
    const booking = bookings[step.id];
    return booking && (booking.state === "booked" || !step.scheduledAt) ? (
      <BookingChip booking={booking} onBook={() => on.book(booking.key)} onUndo={() => on.unbook(booking.key)} />
    ) : null;
  };
  // On a roadmap strip: the chip, else the step's time once booked.
  const slot = (step: Step) => {
    const chip = chipFor(step);
    // shortcut: phones hide later steps' chips so Start stays near the card; Stop for now still offers the next one.
    if (chip) return <div className="shrink-0 max-sm:hidden">{chip}</div>;
    return step.scheduledAt ? <span className="shrink-0 font-mono text-ink-2">{whenLabel(step.scheduledAt, zone())}</span> : null;
  };

  const answerChips = props.chips.map((chip, i) => (
    <button
      key={chip.label}
      type="button"
      data-answer
      aria-disabled={props.busy}
      onClick={() => {
        if (props.busy) return;
        pressed.current = true;
        on.chip(i);
      }}
      className={`pill ${chip.tone === "ink" ? "pill-ink" : chip.tone === "quiet" ? "pill-quiet" : ""} ${pick && i === 0 ? "col-span-2" : ""}`}
    >
      {chip.label}
    </button>
  ));
  const offerChips = (props.offers ?? []).map((booking) => (
    <BookingChip key={booking.key} booking={booking} ink={screen === "wrap" || screen === "setup"} onBook={() => on.book(booking.key)} onUndo={() => on.unbook(booking.key)} />
  ));

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-desk text-ink">
      <header className="mx-auto flex w-full max-w-[1224px] items-center justify-between gap-2 px-4 pt-4 sm:px-8 sm:pt-6 short:pt-3">
        <div className="flex items-center gap-2 text-[24px] font-bold">
          <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
            <rect width="34" height="34" rx="9" fill="var(--ink)" />
            <path d="M10 11h14l-9.5 12H24" fill="none" stroke="var(--card)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Phones keep the mark; the bar needs the room for the streak and the account. */}
          <span className="max-sm:sr-only">Zeno</span>
        </div>
        <div className="flex min-h-14 items-center gap-2 sm:gap-4">
          {pile && (
            <p className="text-ink-2 max-sm:hidden min-[1120px]:hidden">
              <span className="font-mono">{doneCount}</span> done
            </p>
          )}
          {screen && screen !== "signed-out" && streak > 0 && (
            <p className="whitespace-nowrap">
              <span className="font-mono font-bold">{streak}</span>
              <span className="sm:hidden"> {streak === 1 ? "day" : "days"}</span>
              <span className="max-sm:hidden"> day streak</span>
            </p>
          )}
          <Clock />
          {screen && screen !== "signed-out" && (
            <button
              type="button"
              onClick={on.mute}
              className="flex h-14 items-center gap-2 rounded-full px-3 font-medium transition-colors hover:bg-card sm:px-4"
            >
              <Icon name={voice.muted ? "sound-off" : "sound"} />
              <span className="max-sm:sr-only">{voice.muted ? "Sound off" : "Sound on"}</span>
            </button>
          )}
          {screen && screen !== "signed-out" && props.account != null && (
            <AccountMenu initial={props.account} onSignOut={on.signOut} open={props.menuOpen} />
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-2 sm:pb-4 short:pb-2">
        {props.dots ? <Dots {...props.dots} /> : <Stages at={screen ? STAGE_OF[screen] : -1} hidden={screen === "signed-out"} />}

        <p className="sr-only" aria-live="polite">
          {props.line}
        </p>

        <div className="relative mt-6 mb-6 w-full max-w-[760px] short:mt-4 short:mb-4">
          {(screen !== "plan" || steps.length < 2) &&
            [3, 2, 1].map((n) => <i key={n} className="edge" style={{ inset: `${8 * n}px ${16 * n}px ${-8 * n}px` }} />)}

          <article
            // The shell and the ready card are one card, so the first paint never jumps; each setup card is a new one.
            key={
              top
                ? // By title, not id: a plan saved behind its draft swaps ids, and the card must not rise twice.
                  `${screen}:${top.title}`
                : finished
                  ? "finished"
                  : pick
                    ? `pick:${pick.stepId ?? pick.goal}`
                    : screen === "setup"
                      ? `setup:${props.dots?.at}`
                      : screen === "wrap"
                        ? "wrap"
                        : screen ?? "ready"
            }
            className="card rise z-10"
            // The pick card holds four lines, so all of them set its size and Start stays above the dock.
            // A plan's long first step steps down a size: its deadline sits beside it and the roadmap and Start sit under it.
            data-size={
              props.list
                ? cardSize([cardText, ...props.list.map((fact) => fact.text)].join(" "))
                : pick
                  ? cardSize([pick.steps[0].title, pick.goal, atRisk ? "Keep your streak going" : pick.why].join(" "))
                  : screen === "plan" && cardText.length > 32
                    ? "m"
                    : cardSize(cardText)
            }
            // A step card only needs room for its title (and the timer, or a blank row for the stamp), so the roadmap fits under it.
            style={
              top
                ? ({ "--rows": screen === "focus" ? (top.minutes ? 3 : 4) : 2 } as CSSProperties)
                : pick
                  ? ({ "--rows": 3 } as CSSProperties)
                  : finished
                    ? ({ "--rows": 2 } as CSSProperties)
                    : undefined
            }
          >
            <div className="lines">
              {pick ? (
                <>
                  {/* An at-risk evening leads with the streak, in place of the why (Zeno's line says the rest). */}
                  {atRisk && (
                    <p>
                      <span className="hand" style={{ fontWeight: 700 }}>
                        Keep your {streak}-day streak going
                      </span>
                    </p>
                  )}
                  <p>
                    <span className="mins">{pick.steps[0].minutes} min</span>
                    {pick.steps[0].title}
                  </p>
                  <p>
                    <span className="hand text-ink-2">
                      {pick.goal}
                      {pick.due && today ? <span className="whitespace-nowrap"> · {dueLabel(pick.due, today)}</span> : null}
                    </span>
                  </p>
                  {!atRisk && !(pick.due && pick.why.replace(/\.$/, "") === dueLabel(pick.due, today)) && (
                    <p>
                      <span className="hand">{pick.why}</span>
                    </p>
                  )}
                </>
              ) : top ? (
                <>
                  <p>
                    {/* The plan's deadline rides where the minutes would (Start says the minutes), so Start stays above the dock. */}
                    {screen === "plan" && goal?.due && today ? (
                      <span className="mins due">{dueLabel(goal.due, today, true)}</span>
                    ) : screen !== "focus" && top.minutes ? (
                      <span className="mins">{top.minutes} min</span>
                    ) : null}
                    {top.title}
                  </p>
                  {screen === "plan" && top.scheduledAt && bookings[top.id]?.state !== "booked" ? (
                    <p>
                      <span className="hand text-ink-2">On your calendar, {whenLabel(top.scheduledAt, zone())}</span>
                    </p>
                  ) : null}
                  {screen === "focus" && top.minutes ? (
                    <p className="mt-(--lh)">
                      <Countdown minutes={props.timer ?? top.minutes} startedAt={top.startedAt} />
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {cardText && (
                    <p>
                      <Said key={cardText} text={cardText} fade={!finished && cardText !== firstLine} />
                    </p>
                  )}
                  {props.list && (
                    <ul className="facts">
                      {/* Facts wrap in full, so laptops show four and phones three, and Start stays on screen. */}
                      {props.list.slice(0, 4).map((fact, i) => (
                        <li key={fact.id} className={i === 3 ? "max-sm:hidden" : undefined}>
                          <span className="hand">
                            {fact.text}
                            {fact.device && <span className="text-ink-2"> · On this device</span>}
                          </span>
                          <button type="button" className="x" onClick={() => on.remove(fact)} aria-label={`Remove: ${fact.text}`}>
                            <Icon name="close" />
                          </button>
                        </li>
                      ))}
                      {props.reading?.map((text) => (
                        <li key={text}>
                          <span className="hand text-ink-2">{text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {props.list && props.list.length > 3 && (
                    <p className={`text-ink-2 ${props.list.length > 4 ? "" : "sm:hidden"}`}>
                      <span className="hand">
                        +<span className="sm:hidden">{props.list.length - 3}</span>
                        <span className="max-sm:hidden">{props.list.length - 4}</span> more in Memory
                      </span>
                    </p>
                  )}
                  {props.pasting && (
                    <Paste
                      onSave={(text) => {
                        pressed.current = true;
                        on.paste(text);
                      }}
                    />
                  )}
                  {lineOnCard && screen !== "signed-out" && youLine}
                </>
              )}
            </div>
            {props.stamping && <span className="stamp">DONE</span>}
          </article>

          {screen === "plan" &&
            steps.length > 1 &&
            steps.slice(1, 4).map((s, i) => (
              <div
                key={`${s.id}:${s.title}:${s.minutes}`}
                className="strip rise"
                style={{ "--n": i + 1, zIndex: 3 - i, animationDelay: `${(i + 1) * 60}ms` } as CSSProperties}
              >
                {i === 2 && steps.length > 4 ? (
                  <span className="text-ink-2">{steps.length - 3} more steps</span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate max-sm:line-clamp-2 max-sm:whitespace-normal">{s.title}</span>
                    {s.minutes ? <span className="shrink-0 font-mono text-ink-2">{s.minutes} min</span> : null}
                    {slot(s)}
                  </>
                )}
              </div>
            ))}

          {props.leaving && (
            <article className="card leaving" aria-hidden="true">
              <div className="lines" style={{ minHeight: 0 }}>
                <p>{props.leaving.title}</p>
              </div>
              <span className="stamp" style={{ animation: "none" }}>
                DONE
              </span>
            </article>
          )}

          {pile && (
            <div className="pile">
              {Array.from({ length: Math.min(doneCount, 3) }, (_, i) => (
                <i key={i} />
              ))}
              <b aria-hidden="true">DONE</b>
              <p className="absolute top-[96px] w-full text-center text-ink-2">
                <span className="font-mono">{doneCount}</span> done
              </p>
            </div>
          )}
        </div>

        {props.celebrate && progress && progress.week.length > 0 && screen === "checkin" && <StreakRow progress={progress} />}

        {!lineOnCard && (
          <div className="caption mt-2 w-full max-w-[640px] text-center text-[20px] leading-8">
            {props.line && (
              <p>
                <Said key={props.line} text={props.line} fade={props.line !== firstLine} />
              </p>
            )}
            {youLine}
          </div>
        )}

        <p role="status" className="mt-2 max-w-[560px] text-center text-ink-2 empty:mt-0">
          {screen === "signed-out" && props.signInFailed ? "Google sign-in didn't finish. Try again." : props.note}
        </p>

        <NotedLines lines={props.quiet ?? []} />

        {props.hear && !voice.muted && (
          <button
            type="button"
            onClick={() => {
              pressed.current = true;
              on.hear();
            }}
            className="pill pill-small pill-quiet mt-4"
          >
            <Icon name="sound" />
            Hear Zeno
          </button>
        )}

        {/* A question Zeno asks on a step card still gets answers to tap, above the step's own pills. */}
        {!tapFirst && (answerChips.length > 0 || offerChips.length > 0) && (
          <div className="mt-4 flex w-full max-w-[760px] flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            {offerChips}
            {answerChips}
          </div>
        )}

        <div
          ref={pillsRef}
          // Phones stack the answers one per row, so every label stays on one line.
          className={`mt-4 w-full max-w-[760px] empty:mt-0 sm:mt-6 short:mt-4 ${
            tapFirst
              ? // Phones stack the answers; the first card's two short ones share a row under a full-width Start.
                `${pick ? "grid grid-cols-2" : "flex flex-col"} gap-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4`
              : "flex flex-wrap justify-center gap-4 sm:gap-6"
          }`}
        >
          {tapFirst ? (
            <>
              {offerChips}
              {answerChips}
            </>
          ) : (
            labels.map((label, i) => (
              <button
                key={label}
                type="button"
                data-answer
                // aria-disabled, not disabled, so a waiting pill keeps keyboard focus.
                aria-disabled={props.busy}
                onClick={() => {
                  if (props.busy) return;
                  pressed.current = true;
                  if (i === 0) on.primary();
                  else on.secondary();
                }}
                className={`pill max-sm:flex-auto max-sm:px-4 max-sm:text-[18px] sm:min-w-[240px] ${i === 0 ? "pill-ink" : ""}`}
              >
                {label}
              </button>
            ))
          )}
          {/* The plan's first step can go on the calendar instead of starting now. */}
          {screen === "plan" && top && chipFor(top)}
        </div>

        {props.calendarAsk && (screen === "plan" || screen === "wrap") && (
          <button type="button" onClick={on.signIn} className="pill pill-small pill-quiet mt-4">
            <Icon name="today" />
            Let Zeno add to your calendar
          </button>
        )}

        {screen === "focus" && props.checkins != null && (
          <button type="button" aria-pressed={!props.checkins} onClick={on.checkins} className="pill pill-small pill-quiet mt-4">
            <Icon name={props.checkins ? "sound" : "sound-off"} />
            {props.checkins ? "Check-ins on" : "Check-ins muted"}
          </button>
        )}

        {/* Title in the key: a renamed step drops its sources on the server, so the pack starts fresh too. */}
        {screen === "plan" && top && <PrepPack key={`${top.id}:${top.title}`} step={top} />}

        {screen === "signed-out" && (
          <p className="mt-6 max-w-[560px] text-center text-ink-2">
            Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
          </p>
        )}
      </main>

      {/* Setup is one tap per card, so the dock waits until it's done. */}
      {screen && screen !== "signed-out" && screen !== "setup" && (
        // Sticky on the desk ground, so a tall plan or prep pack scrolls under the dock instead of pushing it off screen.
        <nav aria-label="Zeno" className="sticky bottom-0 z-20 flex justify-center gap-2 bg-desk pb-4 sm:gap-4 sm:pt-2 short:pt-0 short:pb-2">
          {/* A blocked mic hands the fill to Type, the way that still works. */}
          <VoiceRing phase={voice.phase} levelRef={voice.levelRef} blocked={blocked} onClick={on.talk} />
          <DockButton ref={typeRef} label="Type" icon="type" filled={blocked} onClick={on.type} />
          <DockButton label="Today" icon="today" onClick={() => on.sheet("today")} />
          <DockButton label="Memory" icon="memory" onClick={() => on.sheet("memory")} />
        </nav>
      )}

      <Desk open={props.sheet === "today"} today={props.today} goal={goal} onClose={() => on.sheet(null)} onSignIn={on.signIn} />
      <SheetPanel open={props.sheet === "memory"} title="Memory" onClose={() => on.sheet(null)}>
        {props.sheet === "memory" && (
          <>
            <MemorySheet memories={props.memories} device={props.device ?? []} onForget={on.forget} onAdd={on.add} onRetry={on.retryMemory} />
            {/* A failed Forget or save says so here, where the person is looking. */}
            <p role="status">{props.note}</p>
          </>
        )}
      </SheetPanel>
    </div>
  );
}

// Signed out, the row keeps its room (invisible) so the card doesn't jump when the loading shell resolves.
function Stages({ at, hidden }: { at: number; hidden: boolean }) {
  return (
    <ol
      aria-label={at >= 0 ? `Step ${at + 1} of ${STAGES.length}: ${STAGES[at]}` : "Your day, in four steps"}
      className={`mt-4 grid w-full max-w-[760px] grid-cols-4 gap-2 sm:mt-6 sm:gap-6 short:mt-3 ${hidden ? "invisible" : ""}`}
    >
      {STAGES.map((name, i) => (
        <li
          key={name}
          aria-current={i === at ? "step" : undefined}
          className={`border-t-4 pt-2 ${i <= at ? "border-ink" : "border-track"} ${i === at ? "font-bold whitespace-nowrap" : "text-ink-2"}`}
        >
          {/* Phones show only the current step's name; it may run under the next bars. */}
          <span className={i === at ? undefined : "max-sm:sr-only"}>{name}</span>
        </li>
      ))}
    </ol>
  );
}

function Clock() {
  const now = useNow();
  if (!now) return null;
  const date = new Date(now);
  return (
    <p className="font-medium whitespace-nowrap">
      {/* Phones keep just the time; the date would crowd out Sound. */}
      <span className="max-lg:hidden">
        {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        <span className="px-2 text-ink-2" aria-hidden="true">
          ·
        </span>
      </span>
      <span className="font-mono">{date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
    </p>
  );
}

function Countdown({ minutes, startedAt }: { minutes: number; startedAt: string | null }) {
  const now = useNow();
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const left = now && !Number.isNaN(started) ? Math.min(minutes * 60, minutes * 60 - (now - started) / 1000) : minutes * 60;
  return (
    <>
      <span className="timer">{clock(left)}</span>
      <span className="sr-only"> left</span>
    </>
  );
}

// Zeno's words, whole at once. aria-hidden because the live region above the card reads the same line once.
function Said({ text, fade }: { text: string; fade: boolean }) {
  return (
    <span className={fade ? "fade" : undefined} aria-hidden="true">
      {text}
    </span>
  );
}

// The box stays, empty and focused, after each send, so the conversation can go on.
function Write({ busy, onSend, onClose }: { busy: boolean; onSend(text: string): void; onClose(): void }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    const text = box.current?.value.trim();
    // While Zeno is busy the words wait in the box for the next Enter, so two turns never run at once.
    if (!box.current || !text || busy) return;
    onSend(text);
    box.current.value = "";
    box.current.focus();
  };
  return (
    <div className="flex items-start gap-4">
      <textarea
        ref={box}
        autoFocus
        rows={1}
        enterKeyHint="send"
        className="write min-w-0 flex-1"
        aria-label="Type to Zeno"
        placeholder="Type to Zeno"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
      />
      <button type="button" aria-disabled={busy} onClick={send} className="pill pill-small pill-ink send shrink-0">
        Send
      </button>
    </div>
  );
}

function Paste({ onSave }: { onSave(text: string): void }) {
  const box = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="flex flex-col items-end gap-4">
      <textarea ref={box} autoFocus rows={3} className="write paste" aria-label="Your notes" placeholder="Paste notes here" />
      <button
        type="button"
        onClick={() => {
          const text = box.current?.value.trim();
          if (text) onSave(text);
          else box.current?.focus();
        }}
        className="pill pill-small pill-ink"
      >
        Save notes
      </button>
    </div>
  );
}

function Dots({ at, of }: { at: number; of: number }) {
  return (
    <ol
      aria-label={at < of ? `Setup, card ${at + 1} of ${of}` : "Setup done"}
      className="mt-4 flex h-9 w-full max-w-[760px] items-center justify-center gap-3 sm:mt-6 short:mt-3"
    >
      {Array.from({ length: of }, (_, i) => (
        <li key={i} aria-current={i === at ? "step" : undefined} className={`size-3 rounded-full ${i <= at ? "bg-ink" : "bg-track"}`} />
      ))}
    </ol>
  );
}

function DockButton({
  label,
  icon,
  filled,
  onClick,
  ref,
}: {
  label: string;
  icon: IconName;
  filled?: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-2 rounded-2xl font-medium sm:w-[88px]">
      <span className="grid h-[120px] place-items-center max-sm:h-24 short:h-24">
        <span className={`knob tap ${filled ? "knob-ink" : ""}`}>
          <Icon name={icon} />
        </span>
      </span>
      {label}
    </button>
  );
}

function SheetPanel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The heading takes focus, so Close only shows its ring once someone tabs to it.
      dialog.querySelector("h2")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="sheet"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex min-h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 tabIndex={-1} className="text-[28px] leading-10 font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="pill pill-small">
            <Icon name="close" />
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

type IconName = "type" | "today" | "memory" | "sound" | "sound-off" | "close";

const ICON_PATHS: Record<IconName, ReactNode> = {
  type: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
    </>
  ),
  today: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  memory: <path d="M7.5 3.5h9a1 1 0 0 1 1 1v16l-5.5-3.8-5.5 3.8v-16a1 1 0 0 1 1-1z" />,
  sound: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  "sound-off": <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
