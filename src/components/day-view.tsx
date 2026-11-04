"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CanvasAssignment, CanvasBrief, DayEmail, DayEvent, Deadline, FreeSlot, Goal, Memory, Progress, SourceState, Step } from "@/lib/day";
import { localDate } from "@/lib/tz";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { barCaption, cardSize, clock, openSteps, type ChoiceCard, type Fact, type Screen } from "@/components/day-flow";
import AccountMenu from "@/components/account-menu";
import BookingChip, { type Booking } from "@/components/booking-chip";
import CanvasSheet from "@/components/canvas-sheet";
import Desk from "@/components/desk";
import { bookedEvents } from "@/components/desk-rows";
import FocusMusic from "@/components/focus-music";
import { DeskMaterials, GoalStrip, StepsList, type Materials } from "@/components/goal-desk";
import MemorySheet from "@/components/memory-sheet";
import StreakRow from "@/components/streak-row";
import VoiceRing from "@/components/voice-ring";

// "week" opens the desk on its Week view.
export type Sheet = "today" | "week" | "memory" | "canvas" | null;

// home: the hello and the goal options; desk: the current plan's desk, the workstation around its step (Vi, Nov 3).
export type View = "home" | "desk";

export type Today = {
  events: DayEvent[];
  emails: DayEmail[];
  unreadEmail: number;
  sources: { calendar: SourceState; email: SourceState; goals: SourceState };
  // The rest of today's free time and the next deadlines (missing from days saved before they existed).
  free?: FreeSlot[];
  deadlines?: Deadline[];
  mailUrl?: string; // this account's Gmail, for the inbox's "Open Gmail"
};

export type DayViewProps = {
  screen: Screen | null; // null until the browser knows whose day it is
  // The ready screen and talk show the home or the plan's desk; Focus and the screen after Done are always on the desk.
  view?: View;
  hello?: string; // the home's greeting, "Hey Maya."
  line: string; // Zeno's latest line
  you: string; // the person's words: live while listening, then what they sent
  goal: Goal | null;
  goals?: Goal[]; // every open plan, for the home's options and the Desk (Vi, Nov 3)
  choices?: ChoiceCard[]; // the home's goal options, 3 at most
  planning?: { title: string; due: string | null; line: string } | null; // a desk whose plan is still being made
  proposed?: Step | null; // the step Zeno proposes on the desk
  materials?: Materials; // what lies on the desk beside the step
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
  pasting: boolean; // the first sign-in card takes pasted notes
  hear: boolean; // the browser held Zeno's voice back until a tap
  progress: Progress | null; // the streak for the top bar and the row after a Done
  celebrate?: boolean; // a Done just happened: show the streak row
  bookings?: Record<string, Booking>; // booking chips by key
  offers?: Booking[]; // booking chips that answer Zeno's line
  timer?: number | null; // Focus's planned minutes when the tap said so ("Start · 5 min"), shown beside the stopwatch
  quiet?: boolean; // the line under the Focus card is one of Zeno's quiet ones (calm, check-in, welcome back): muted
  brief?: CanvasBrief; // the Canvas assignment the plan is for, so the sources search uses its instructions
  device?: VaultFact[]; // this device's private facts, for Memory
  account?: string | null; // the person's initial
  canvas?: { account: string; linked: boolean } | null; // Canvas on this device, once the page knows whose account it is
  calendarAsk?: boolean; // Zeno may not add to the calendar yet: the account menu offers to allow it
  menuOpen?: boolean; // the /preview gallery shows the account menu open
  voice: { phase: VoicePhase; levelRef: { current: number }; muted: boolean; supported: boolean; error: VoiceError };
  on: {
    chip(index: number): void;
    choose(index: number): void; // a home option: its plan's desk
    snap(photo: File): void; // "Add from a photo": Muse Spark reads an assignment's photo, and its plan's desk opens
    home(): void; // the Zeno mark and "← All goals"
    propose(stepId: string): void; // a todo step tapped on the desk becomes the proposed one
    hear(): void;
    paste(text: string): void;
    talk(): void;
    type(): void;
    closeTyping(): void;
    send(text: string): void;
    sheet(sheet: Sheet): void;
    forget(fact: Fact): void;
    add(text: string): Promise<boolean>; // false: the save failed, so Memory's box gives the text back
    retryMemory(): void;
    book(key: string): void;
    unbook(key: string): void;
    mute(): void;
    signIn(): void;
    signOut(): void;
    canvasSynced(assignments: CanvasAssignment[]): void; // Canvas linked in its sheet (what it found), or unlinked ([])
    // The Desk's working cards (Vi, Nov 3): open a plan's desk, plan a deadline and open its desk, answer an email.
    openGoal(goalId: string): void;
    openDeadline(deadline: Deadline): void;
    reply(email: DayEmail): void;
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
export function useToday() {
  return useSyncExternalStore(everyMinute, () => localDate(zone()), () => "");
}

export default function DayView(props: DayViewProps) {
  const { screen, goal, voice, on, progress } = props;
  const bookings = props.bookings ?? {};
  const planning = props.planning ?? null;
  // Focus and the screen after Done are always on the plan's desk; the card and talk are once she opened it (Vi, Nov 3).
  const desk = Boolean(planning || goal) && (screen === "focus" || screen === "checkin" || ((screen === "ready" || screen === "talk") && props.view === "desk"));
  const home = !desk && (screen === "ready" || screen === null);
  // Focus is the step's own card, with its timer; the desk's card proposes the next step; every other card holds Zeno's
  // line (while a plan is made, what is happening).
  const top = screen === "focus" ? openSteps(goal)[0] ?? null : null;
  const next = desk && screen === "ready" && !planning ? props.proposed ?? null : null;
  const cardLine = planning && screen === "ready" ? planning.line : props.line;
  // The step the bar and the steps mark: the proposed one, the running one, or after a Done the one up next.
  const marked = next?.id ?? top?.id ?? (screen === "checkin" ? openSteps(goal)[0]?.id : props.proposed?.id);
  const steps = goal?.steps ?? [];
  const done = steps.filter((s) => s.status === "done").length;
  const choices = home ? props.choices ?? [] : [];
  const lineOnCard = !top && !next;
  // "Add from a photo" ends the home's links, with goal options or without them, once its answers are live.
  const photo = home && screen === "ready" && !props.busy;
  const doneCount = done - (props.leaving ? 1 : 0);
  const pile = (screen === "focus" || screen === "checkin") && doneCount > 0;
  const blocked = voice.error === "blocked";
  // A booking offer that answers Zeno's line (in talk, or after stopping) is the big button; the answers are then links.
  // Once booked it is a status line, so the first answer is the big button again. On the home the options are the
  // choice, so its answers are links under them.
  const lead = screen === "talk" || screen === "wrap" ? props.offers?.[0] : undefined;
  const big = (lead && lead.state !== "booked") || props.pasting || choices.length > 0 ? null : props.chips[0] ?? null;
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
        ? "Tap Talk or the keyboard to answer."
        : "Tap the keyboard to answer."
      : "";
  const today = useToday();
  const streak = progress?.streak ?? 0;
  const signedIn = screen !== null && screen !== "signed-out" && screen !== "setup";
  // Sources are found for the step the desk shows (after a Done, the one up next).
  const sourceStep = next ?? top ?? (screen === "checkin" ? openSteps(goal)[0] : props.proposed) ?? null;

  const mainRef = useRef<HTMLElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pressed = useRef(false);
  const answersKey = `${screen}:${desk}:${next?.id}:${hear}:${props.chips.join("|")}:${choices.length}:${(props.offers ?? []).map((offer) => offer.state).join(",")}`;
  // Home, a plan's desk or a card: each opens at the top of the page, so the strip and the hello are never scrolled off.
  const place = desk ? `desk:${planning?.title ?? goal?.id}` : home ? "home" : "card";
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [place]);
  useEffect(() => {
    // After a press, keyboard focus follows the screen to its big button (on the home, its first option), unless it
    // went somewhere else on its own.
    const area = mainRef.current;
    const button = area?.querySelector<HTMLElement>(".pill-big, .choice");
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
    // On a goal's desk the scroll stops where the goal strip would leave the top, so a Done shows its bar fill (live,
    // Nov 3: Done scrolled the bar off a 1440x900 laptop); the links may then sit in the dock's fade.
    const strip = document.querySelector<HTMLElement>('main section[aria-label="Goal"]');
    const room = strip ? Math.max(0, strip.getBoundingClientRect().top - 8) : Infinity;
    const need = Math.min(bottom - (dockTop - 16), room);
    if (top < innerHeight && need > 0) {
      window.scrollBy({ top: need, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
  const choose = (i: number) => {
    if (props.busy) return;
    pressed.current = true;
    on.choose(i);
  };
  const goHome = () => {
    pressed.current = true;
    on.home();
  };
  const offerChip = (booking: Booking, isBig = false) => (
    <BookingChip key={booking.key} booking={booking} big={isBig} onBook={() => on.book(booking.key)} onUndo={() => on.unbook(booking.key)} />
  );
  const mark = (
    <>
      <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="9" fill="var(--ink)" />
        <path d="M10 11h14l-9.5 12H24" fill="none" stroke="var(--card)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Zeno
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-desk text-ink">
      <header className="mx-auto flex w-full max-w-[1224px] items-center justify-between gap-2 px-4 pt-4 sm:px-8 sm:pt-6 short:pt-3">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* The mark goes home, to the goal options; Desk opens the working cards (Vi, Nov 3). */}
          {signedIn ? (
            <button type="button" onClick={goHome} className="flex items-center gap-2 rounded-xl text-[24px] font-bold" aria-label="Zeno: all goals">
              {mark}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[24px] font-bold">{mark}</div>
          )}
          {signedIn && (
            <button type="button" onClick={() => on.sheet("today")} className="link" data-lead>
              Desk
            </button>
          )}
        </div>
        <div className="flex min-h-14 items-center gap-2 sm:gap-4">
          {screen && screen !== "signed-out" && streak > 0 && (
            <p className="whitespace-nowrap">
              <span className="font-mono font-bold">{streak}</span>
              {/* Under 360px the word goes, so the account button keeps its gutter. */}
              <span className="sm:hidden max-[359px]:hidden"> {streak === 1 ? "day" : "days"}</span>
              <span className="max-sm:hidden"> day streak</span>
            </p>
          )}
          {screen && screen !== "signed-out" && props.account != null && (
            <AccountMenu
              initial={props.account}
              muted={voice.muted}
              canvas={props.canvas ? props.canvas.linked : null}
              onMemory={() => on.sheet("memory")}
              onMute={on.mute}
              onCanvas={() => on.sheet("canvas")}
              onCalendar={props.calendarAsk ? on.signIn : undefined}
              onSignOut={on.signOut}
              open={props.menuOpen}
            />
          )}
        </div>
      </header>

      <main ref={mainRef} className="flex flex-1 flex-col items-center px-4 pb-2 sm:pb-4 short:pb-2">
        <p className="sr-only" aria-live="polite">
          {cardLine}
        </p>

        {home ? (
          <>
            {/* The hello (Vi, Nov 3): her name and Zeno's line on one card, then the goals to choose from. */}
            <article className="card hello rise z-10 mt-6 w-full max-w-[760px] short:mt-4">
              <div className="lines">
                {props.hello && <h1 className="font-bold">{props.hello}</h1>}
                {props.line && (
                  <p>
                    <span className="hand">
                      <Said key={props.line} text={props.line} fade={props.line !== firstLine} />
                    </span>
                  </p>
                )}
                {screen !== null && youLine}
              </div>
            </article>
            {choices.length > 0 && (
              <section aria-labelledby="choices" className="mt-6 w-full max-w-[760px] short:mt-4">
                <h2 id="choices" className="text-[20px] leading-8 font-bold">
                  What are we working on?
                </h2>
                {/* A few options, each one big tap target; none is marked as Zeno's pick. */}
                <ul className="mt-2 flex flex-col gap-2">
                  {choices.map((choice, i) => (
                    <li key={`${i}:${choice.title}`}>
                      <button type="button" data-answer aria-disabled={props.busy} onClick={() => choose(i)} className="choice">
                        <span className="lines block">
                          <span className="flex items-baseline justify-between gap-4">
                            <span className="line-clamp-2 min-w-0 font-bold">{choice.title}</span>
                            {choice.minutes ? <span className="shrink-0 font-mono text-ink-2">{choice.minutes} min</span> : null}
                          </span>
                          <span className="block truncate text-[18px] text-ink-2">{choice.meta}</span>
                          {choice.last && <span className="block truncate text-[18px]">{choice.last}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            {desk && (
              <div className="mt-2 w-full max-w-[760px] sm:mt-4 short:mt-0">
                <button type="button" onClick={goHome} className="link -ml-1">
                  ← All goals
                </button>
                <GoalStrip
                  title={planning?.title ?? goal?.title ?? ""}
                  due={planning ? planning.due : goal?.due}
                  steps={planning ? [] : steps}
                  marked={marked}
                  caption={barCaption(done, steps.length, screen === "checkin" && Boolean(props.celebrate))}
                  today={today}
                />
              </div>
            )}

            <div className={`relative mb-6 w-full max-w-[760px] short:mb-4 ${desk ? "mt-4" : "mt-6 short:mt-4"}`}>
              {[3, 2, 1].map((n) => (
                <i key={n} className="edge" style={{ inset: `${8 * n}px ${16 * n}px ${-8 * n}px` }} />
              ))}

              <article
                key={
                  top
                    ? // By title, not id: a plan changed in talk can swap ids, and the card must not rise twice.
                      `focus:${top.title}`
                    : next
                      ? `next:${next.id}`
                      : planning
                        ? "planning"
                        : screen ?? "ready"
                }
                className="card rise z-10"
                // Sized by the step on the desk and in Focus alike, so Start keeps the hand's size.
                data-size={cardSize(top ? top.title : next ? `Next: ${next.title}` : cardLine)}
                // A step card: its title and the stopwatch, each on its own rule, and room for the stamp, so Focus keeps
                // the title on screen; after a Done the line sits over the streak row and Keep going.
                style={top || next ? ({ "--rows": 3 } as CSSProperties) : screen === "checkin" || planning ? ({ "--rows": 2 } as CSSProperties) : undefined}
              >
                <div className="lines">
                  {next ? (
                    <p>
                      {next.minutes ? <span className="mins">{next.minutes} min</span> : null}
                      Next: {next.title}
                    </p>
                  ) : top ? (
                    <>
                      <p>{top.title}</p>
                      <Stopwatch startedAt={top.startedAt} planned={props.timer ?? top.minutes} />
                    </>
                  ) : (
                    <>
                      {cardLine && (
                        <p>
                          <Said key={cardLine} text={cardLine} fade={cardLine !== firstLine} />
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

            {/* Under a step card, Zeno's quiet Focus line and the person's words. */}
            {!lineOnCard && (
              <div className="caption mt-2 w-full max-w-[640px] text-center text-[20px] leading-8 empty:hidden">
                {top && props.line && (
                  <p className={props.quiet ? "text-ink-2" : undefined}>
                    <Said key={props.line} text={props.line} fade={props.line !== firstLine} />
                  </p>
                )}
                {youLine}
              </div>
            )}
          </>
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
          {(links.length > 0 || hear || photo) && (
            <div className="links">
              {/* Each "·" travels with the link after it; on a phone, where the row wraps, space alone sets them apart. */}
              {links.map((label, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <button type="button" data-answer aria-disabled={props.busy} onClick={() => answer(firstLink + i)} className="link">
                    {label}
                  </button>
                </span>
              ))}
              {hear && (
                <span className="flex items-center gap-2">
                  {links.length > 0 && (
                    <span aria-hidden="true" className="max-sm:hidden">
                      ·
                    </span>
                  )}
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
                </span>
              )}
              {photo && (
                <span className="flex items-center gap-2">
                  {(links.length > 0 || hear) && (
                    <span aria-hidden="true" className="max-sm:hidden">
                      ·
                    </span>
                  )}
                  <button type="button" onClick={() => photoRef.current?.click()} className="link">
                    Add from a photo
                  </button>
                </span>
              )}
              <FocusMusic active={screen === "focus"} />
            </div>
          )}
        </div>

        {/* The steps and the materials stay below the step, in Focus too. */}
        {desk && !planning && goal && (
          <>
            <StepsList steps={steps} marked={marked} onPropose={screen === "ready" ? on.propose : undefined} />
            <DeskMaterials key={sourceStep?.id ?? "none"} materials={props.materials} step={sourceStep} brief={props.brief} />
          </>
        )}

        {/* No capture attribute, so a phone offers Take Photo or the library, and a laptop a file picker. Always mounted
            while signed in, so a pick still arrives if the home redraws behind the picker. */}
        {signedIn && (
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // the same photo picked again still counts
              if (!file) return;
              pressed.current = true;
              on.snap(file);
            }}
          />
        )}

        {screen === "signed-out" && (
          <p className="mt-6 max-w-[560px] text-center text-ink-2">
            Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
          </p>
        )}
      </main>

      {/* First sign-in is one card and its links, so the dock waits until it's done. Talk, and typing one tap beside it. */}
      {signedIn && (
        <nav aria-label="Zeno" className="dock">
          <div className="dock-row">
            <VoiceRing phase={voice.phase} levelRef={voice.levelRef} blocked={blocked} onClick={on.talk} />
            {/* A blocked mic makes typing the way that still works, so it fills in ink. */}
            <button ref={typeRef} type="button" onClick={on.type} className="kbd" aria-label="Type to Zeno" data-lead={blocked || undefined}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.5M7.5 14h9" />
              </svg>
            </button>
          </div>
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
        goals={props.goals}
        progress={props.progress ?? undefined}
        onGoal={on.openGoal}
        onDeadline={on.openDeadline}
        onReply={on.reply}
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
      <SheetPanel open={props.sheet === "canvas"} title="Canvas" onClose={() => on.sheet(null)}>
        {props.sheet === "canvas" && props.canvas && <CanvasSheet account={props.canvas.account} onSynced={on.canvasSynced} />}
      </SheetPanel>
    </div>
  );
}

// Counts up from the step's saved start, never down, with no alarm, chime or speech at any point (Vi, Nov 3); Muse's
// planned minutes sit beside it, small and muted, and drop to the next rule only on a very narrow screen.
function Stopwatch({ startedAt, planned }: { startedAt: string | null; planned: number | null }) {
  const now = useNow();
  const started = startedAt ? Date.parse(startedAt) : NaN;
  return (
    <p>
      <span className="timer">{clock(now && !Number.isNaN(started) ? (now - started) / 1000 : 0)}</span>
      <span className="sr-only"> so far</span>
      <wbr />
      {planned ? (
        <span className="planned">
          planned <span className="font-mono">{planned} min</span>
        </span>
      ) : null}
    </p>
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
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
