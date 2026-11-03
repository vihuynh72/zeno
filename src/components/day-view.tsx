"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import type { DayEmail, DayEvent, Deadline, FirstPick, FreeSlot, Goal, Memory, Progress, SourceState, Step } from "@/lib/day";
import { localDate } from "@/lib/tz";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { cardSize, clock, dueLabel, openSteps, type Fact, type Screen } from "@/components/day-flow";
import AccountMenu from "@/components/account-menu";
import BookingChip, { type Booking } from "@/components/booking-chip";
import Desk from "@/components/desk";
import { bookedEvents } from "@/components/desk-rows";
import MemorySheet from "@/components/memory-sheet";
import type { Booked } from "@/components/week-grid";
import PrepPack from "@/components/prep-pack";
import StreakRow from "@/components/streak-row";
import VoiceRing from "@/components/voice-ring";

// "week" opens the desk on its Week view.
export type Sheet = "today" | "week" | "memory" | null;

export type Today = {
  events: DayEvent[];
  emails: DayEmail[];
  unreadEmail: number;
  sources: { calendar: SourceState; email: SourceState; goals: SourceState };
  // The rest of today's free time and the next deadlines (missing from days saved before they existed).
  free?: FreeSlot[];
  deadlines?: Deadline[];
};

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
  busy: boolean; // a save is in flight, so the answers wait
  // The screen's answers (Vi, Nov 2): the first is its one big button, the rest small links under it. All are links
  // under pasted notes, or beside a booking offer that answers Zeno's line (then the offer is the big button).
  chips: string[];
  dots: { at: number; of: number } | null; // setup progress
  list: Fact[] | null; // what setup learned, each removable
  reading?: string[]; // what setup is still reading ("Reading your notes…")
  pasting: boolean; // the setup card takes pasted notes
  hear: boolean; // the browser held Zeno's voice back until a tap
  progress: Progress | null; // the streak for the top bar and the row after a Done
  pick?: FirstPick | null; // the card's one thing, on the ready screen
  celebrate?: boolean; // a Done just happened: show the streak row
  bookings?: Record<string, Booking>; // booking chips by key
  offers?: Booking[]; // booking chips that answer Zeno's line
  timer?: number | null; // the focus timer's minutes when the tap said so ("Start · 5 min")
  sources?: boolean; // Focus shows the step's sources (its Sources link was tapped)
  device?: VaultFact[]; // this device's private facts, for Memory
  account?: string | null; // the person's initial
  menuOpen?: boolean; // the /preview gallery shows the account menu open
  voice: { phase: VoicePhase; levelRef: { current: number }; muted: boolean; supported: boolean; error: VoiceError };
  on: {
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
    mute(): void;
    signIn(): void;
    signOut(): void;
    booked?(change: Booked): void; // a block booked or taken off in the desk's Week
  };
};

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
  // Focus is the step's own card, with its timer; the ready card holds the pick; every other card holds Zeno's line.
  const top = screen === "focus" ? openSteps(goal)[0] ?? null : null;
  const pick = screen === "ready" && props.pick ? props.pick : null;
  const lineOnCard = !top && !pick;
  const doneCount = (goal?.steps.filter((s) => s.status === "done").length ?? 0) - (props.leaving ? 1 : 0);
  const pile = (screen === "focus" || screen === "checkin") && doneCount > 0;
  const blocked = voice.error === "blocked";
  // A booking offer that answers Zeno's line (in talk, or after stopping) is the big button; the answers are then links.
  const lead = screen === "talk" || screen === "wrap" ? props.offers?.[0] : undefined;
  const big = lead || props.pasting ? null : props.chips[0] ?? null;
  const firstLink = big === null ? 0 : 1;
  const links = props.chips.slice(firstLink);
  const otherOffers = (props.offers ?? []).filter((offer) => offer !== lead);
  const hear = props.hear && !voice.muted;
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

  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  const answersKey = `${screen}:${props.dots?.at}:${hear}:${props.chips.join("|")}:${(props.offers ?? []).map((offer) => offer.state).join(",")}`;
  useEffect(() => {
    // After a press, keyboard focus follows the screen to its big button, unless it went somewhere else on its own.
    const area = pillsRef.current;
    const button = area?.querySelector<HTMLElement>(".pill-big");
    if (!pressed.current || !button) return;
    pressed.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || area?.contains(active)) button.focus({ preventScroll: true });
  }, [answersKey]);
  useEffect(() => {
    // A tall card or line can leave the answers under the sticky dock or its fade; bring them clear of it (html's
    // scroll-padding-bottom is the dock). Answers far below, under an open desk, stay put.
    const pills = pillsRef.current;
    if (!pills) return;
    const { top, bottom } = pills.getBoundingClientRect();
    const dockTop = document.querySelector(".dock")?.getBoundingClientRect().top ?? innerHeight;
    if (top < innerHeight && bottom > dockTop - 16) {
      pills.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
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

  const answer = (i: number) => {
    if (props.busy) return;
    pressed.current = true;
    on.chip(i);
  };
  const offerChip = (booking: Booking, isBig = false) => (
    <BookingChip key={booking.key} booking={booking} big={isBig} onBook={() => on.book(booking.key)} onUndo={() => on.unbook(booking.key)} />
  );

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
              {/* Under 360px the word goes, so the account button keeps its gutter. */}
              <span className="sm:hidden max-[359px]:hidden"> {streak === 1 ? "day" : "days"}</span>
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
        {props.dots && <Dots {...props.dots} />}

        <p className="sr-only" aria-live="polite">
          {props.line}
        </p>

        <div className="relative mt-6 mb-6 w-full max-w-[760px] short:mt-4 short:mb-4">
          {[3, 2, 1].map((n) => (
            <i key={n} className="edge" style={{ inset: `${8 * n}px ${16 * n}px ${-8 * n}px` }} />
          ))}

          <article
            // The shell and the ready card are one card, so the first paint never jumps; each setup card is a new one.
            key={
              top
                ? // By title, not id: a plan saved behind its draft swaps ids, and the card must not rise twice.
                  `focus:${top.title}`
                : pick
                  ? `pick:${pick.stepId ?? pick.goal}`
                  : screen === "setup"
                    ? `setup:${props.dots?.at}`
                    : screen ?? "ready"
            }
            className="card rise z-10"
            data-size={
              props.list
                ? cardSize([props.line, ...props.list.map((fact) => fact.text)].join(" "))
                : pick
                  ? cardSize(`${pick.steps[0].title} ${pick.goal}`)
                  : cardSize(top ? top.title : props.line)
            }
            // A step card only needs room for its title and the timer (or a blank row for the stamp); after a Done the
            // line sits over the streak row and Keep going.
            style={
              top
                ? ({ "--rows": top.minutes ? 3 : 4 } as CSSProperties)
                : pick
                  ? ({ "--rows": 3 } as CSSProperties)
                  : screen === "checkin"
                    ? ({ "--rows": 2 } as CSSProperties)
                    : undefined
            }
          >
            <div className="lines">
              {pick ? (
                <>
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
                </>
              ) : top ? (
                <>
                  <p>{top.title}</p>
                  {top.minutes ? (
                    <p className="mt-(--lh)">
                      <Countdown minutes={props.timer ?? top.minutes} startedAt={top.startedAt} />
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {props.line && (
                    <p>
                      <Said key={props.line} text={props.line} fade={props.line !== firstLine} />
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
                          <button
                            type="button"
                            className="x"
                            onClick={(event) => {
                              // Focus moves to the next fact's ×, not to the page, when this one goes.
                              const li = event.currentTarget.closest("li");
                              (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector("button")?.focus();
                              on.remove(fact);
                            }}
                            aria-label={`Remove: ${fact.text}`}
                          >
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
                  {screen !== "signed-out" && youLine}
                </>
              )}
            </div>
            {props.stamping && <span className="stamp">DONE</span>}
          </article>

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

        {/* Under the ready card only the person's words show: Zeno's line there is spoken (Vi, Nov 2). */}
        {!lineOnCard && (
          <div className="caption mt-2 w-full max-w-[640px] text-center text-[20px] leading-8 empty:hidden">
            {top && props.line && (
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

        <div ref={pillsRef} className="mt-4 flex w-full max-w-[760px] flex-col items-center gap-2 empty:mt-0 sm:mt-6 short:mt-4">
          {lead && offerChip(lead, true)}
          {big !== null && (
            // aria-disabled, not disabled, so a waiting button keeps keyboard focus.
            <button type="button" data-answer aria-disabled={props.busy} onClick={() => answer(0)} className="pill pill-ink pill-big">
              {big}
            </button>
          )}
          {otherOffers.length > 0 && <div className="flex flex-wrap justify-center gap-2">{otherOffers.map((offer) => offerChip(offer))}</div>}
          {(links.length > 0 || hear) && (
            <div className="links">
              {links.map((label, i) => (
                <Fragment key={i}>
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <button type="button" data-answer aria-disabled={props.busy} onClick={() => answer(firstLink + i)} className="link">
                    {label}
                  </button>
                </Fragment>
              ))}
              {hear && (
                <>
                  {links.length > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    onClick={() => {
                      pressed.current = true;
                      on.hear();
                    }}
                    className="link"
                  >
                    Hear Zeno
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Title in the key: a renamed step drops its sources on the server, so the pack starts fresh too. */}
        {top && props.sources && <PrepPack key={`${top.id}:${top.title}`} step={top} />}

        {screen === "signed-out" && (
          <p className="mt-6 max-w-[560px] text-center text-ink-2">
            Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
          </p>
        )}
      </main>

      {/* Setup is one tap per card, so the dock waits until it's done. */}
      {screen && screen !== "signed-out" && screen !== "setup" && (
        // Sticky on the desk ground, so a tall plan or prep pack scrolls under the dock instead of pushing it off screen.
        <nav aria-label="Zeno" className="dock sticky bottom-0 z-20 flex justify-center gap-2 bg-desk pb-4 sm:gap-4 sm:pt-2 short:pt-0 short:pb-2">
          {/* A blocked mic hands the fill to Type, the way that still works. */}
          <VoiceRing phase={voice.phase} levelRef={voice.levelRef} blocked={blocked} onClick={on.talk} />
          <DockButton ref={typeRef} label="Type" icon="type" filled={blocked} onClick={on.type} />
          <DockButton label="Today" icon="today" onClick={() => on.sheet("today")} />
          <DockButton label="Memory" icon="memory" onClick={() => on.sheet("memory")} />
        </nav>
      )}

      <Desk
        open={props.sheet === "today" || props.sheet === "week"}
        tab={props.sheet === "week" ? "week" : "today"}
        today={props.today}
        goal={goal}
        booked={bookedEvents(Object.values(bookings))}
        onClose={() => on.sheet(null)}
        onSignIn={on.signIn}
        onBooked={on.booked}
      />
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
  const snap = useRef<ReturnType<typeof setTimeout>>(undefined);
  // At rest the notes sit on whole lines, so no line shows cut in half under the heading and the rules meet the card's.
  function settle() {
    const el = box.current;
    const lh = el ? parseFloat(getComputedStyle(el).lineHeight) : 0;
    if (!el || !lh) return;
    const top = Math.round(el.scrollTop / lh) * lh;
    if (Math.abs(top - el.scrollTop) > 1) el.scrollTo({ top, behavior: "smooth" });
  }
  return (
    <div className="flex flex-col items-end gap-4">
      <textarea
        ref={box}
        autoFocus
        rows={3}
        className="write paste"
        aria-label="Your notes"
        placeholder="Paste notes here"
        onScroll={(event) => {
          event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollTop > 0);
          clearTimeout(snap.current);
          snap.current = setTimeout(settle, 150);
        }}
      />
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
