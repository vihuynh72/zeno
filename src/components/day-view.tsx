"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { CanvasAssignment, CanvasBrief, DayEmail, DayEvent, Deadline, DoneStep, FreeSlot, Goal, Memory, Progress, SourceState, Step } from "@/lib/day";
import { localDate } from "@/lib/tz";
import type { App, AppItem } from "@/lib/connect";
import type { VaultFact } from "@/lib/vault";
import type { VoiceError, VoicePhase } from "@/lib/use-voice";
import { barCaption, cardSize, clock, dueLine, openSteps, type Fact, type PanelRow, type Screen } from "@/components/day-flow";
import AccountMenu from "@/components/account-menu";
import GoalsPanel, { FrontDoor, Suggestions } from "@/components/goals-panel";
import BookingChip, { type Booking } from "@/components/booking-chip";
import CanvasSheet from "@/components/canvas-sheet";
import Desk from "@/components/desk";
import { bookedEvents } from "@/components/desk-rows";
import FocusMusic from "@/components/focus-music";
import FocusPop from "@/components/focus-pop";
import { GoalAside, GoalStrip, StepsList, type Materials } from "@/components/goal-desk";
import MemorySheet from "@/components/memory-sheet";
import StreakRow from "@/components/streak-row";
import VoiceRing from "@/components/voice-ring";
import YourApps from "@/components/your-apps";

// "week" opens the desk on its Week view.
export type Sheet = "today" | "week" | "memory" | "canvas" | "apps" | null;

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
  doneThisWeek?: DoneStep[]; // steps finished since Monday, for the Week (missing from days saved before Nov 4)
};

export type DayViewProps = {
  screen: Screen | null; // null until the browser knows whose day it is
  // The ready screen and talk show the home or the plan's desk; Focus and the screen after Done are always on the desk.
  view?: View;
  hello?: string; // the home's greeting, "Hey Maya."
  line: string; // Zeno's latest line
  you: string; // the person's words: live while listening, then what they sent
  goal: Goal | null;
  goals?: Goal[]; // every open plan, for the goals panel and the Desk (Vi, Nov 3)
  held?: Goal[]; // every plan the page holds, finished ones too, so the Week lists steps finished since the day loaded
  suggestions?: PanelRow[]; // the panel's Suggestions: deadlines with no plan and email that asks something (on.choose)
  addWords?: string | null; // words whose plan couldn't be made, back in the add box
  // a desk whose plan is still being made; view: Zeno's questions or Muse's thinking (plan-thinking.tsx) under its card
  planning?: { title: string; due: string | null; line: string; view?: ReactNode } | null;
  // Coming back: the goal she was last on (or one due within 2 days), its next step, and whether she started it.
  resume?: { goal: string; step: string; minutes: number | null; started: boolean; due: string | null } | null;
  stuck?: boolean; // Stuck? is open in Focus: its four ways out, without Pop out and Music beside them
  proposed?: Step | null; // the step Zeno proposes on the desk
  materials?: Materials; // what lies on the desk beside the step
  today: Today | null; // null when the day couldn't load
  memories: Memory[] | "loading" | "error";
  sheet: Sheet;
  typing: boolean;
  retry?: string | null; // typed words whose turn failed, back in the docked box
  stamping: boolean; // the focus card is being stamped DONE
  leaving: Step | null; // the finished card on its way to the pile
  note: string | null; // one plain line under the pills
  toast?: { text: string; undo: boolean } | null; // a short line over Talk for a few seconds: a goal removed (with Undo) or done
  lineUndo?: boolean; // Zeno's line under the card ends in Undo (Skip's "Moved to the end.", round 7)
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
  deskOffer?: Booking; // "For this goal": the next free time that fits the desk's step
  appItems?: AppItem[]; // "For this goal": the goal's own app item and docs, then what connected apps have that matches it
  appRows?: PanelRow[]; // From your apps (Nov 4): connected apps' items that aren't goals yet, soonest due first (on.fromApp)
  connected?: App | null; // back from an app's sign-in (/?connected=<app>): Your apps opens and says so
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
    choose(index: number): void; // a suggestion: a deadline's new plan or an email's reply
    addGoal?(text: string): void; // the add box's words become a plan (POST /api/goal/add)
    closeAdd?(): void; // the add box's Cancel: failed words never come back in it
    snap(photo: File): void; // "Add from a photo": Muse Spark reads an assignment's photo, and its plan's desk opens
    home(): void; // the Zeno mark and "← Goals"
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
    // The Desk's working cards (Vi, Nov 3): open a plan's desk, plan a deadline and open its desk; an email becomes a goal
    // (the Desk closes and it is planned) or a step on one of her goals (false: not saved) (Nov 4).
    openGoal(goalId: string): void;
    openDeadline(deadline: Deadline): void;
    mailGoal?(text: string): void;
    addStep?(goalId: string, title: string): Promise<boolean>;
    followUp?(to: string, subject: string): void; // "Waiting on": mail nobody answered becomes a 2-minute follow-up
    // The links by a desk's goal title (Nov 4): remove the goal or mark it done, and the toast's Undo for a removal.
    closeGoal?(how: "remove" | "finish"): void;
    undo?(): void;
    unskip?(): void;
    // Connected apps (Nov 4): an item of From your apps becomes a goal; a token kept or dropped in Your apps; a doc's
    // link added under For this goal (resolves with a line saying why not, or "" once it shows).
    fromApp?(index: number): void;
    appsChanged?(): void;
    addDoc?(url: string): Promise<string>;
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

// A tall card or line, or a dock that grew, can leave the answers under the sticky dock or its fade: bring them clear of
// it. Answers far below, under an open desk, stay put.
function keepClear(answers: Element | null | undefined, main: HTMLElement | null, grew = false) {
  if (!answers?.childElementCount) return;
  const { bottom } = answers.getBoundingClientRect();
  const dockTop = document.querySelector(".dock")?.getBoundingClientRect().top ?? innerHeight;
  // On a goal's desk the scroll stops before the step card slides under the sticky goal strip (Nov 4), so the step and a
  // Done's bar fill stay in view (live, Nov 3: Done scrolled the bar off a 1440x900 laptop); the links may then sit in the
  // dock's fade. On a phone, and when the dock grew (the text box opened over Zeno's answers on a 1280x720 laptop, Nov 4),
  // the answers win: no button or chip stays under the dock (Nov 4: Keep going sat under it).
  const strip = document.querySelector<HTMLElement>("[data-strip]");
  const card = main?.querySelector(".card");
  const room = !grew && strip && card && innerWidth >= 640 ? Math.max(0, card.getBoundingClientRect().top - strip.offsetHeight - 8) : Infinity;
  const need = Math.min(bottom - (dockTop - 16), room);
  // Even when a long reply pushed them below the fold (round 3: Done and Stuck? sat under Talk on a phone).
  if (need > 0) {
    window.scrollBy({ top: need, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
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
  const lineOnCard = !top && !next;
  const doneCount = done - (props.leaving ? 1 : 0);
  const pile = (screen === "focus" || screen === "checkin") && doneCount > 0;
  const blocked = voice.error === "blocked";
  // A booking offer that answers Zeno's line (in talk, or after stopping) is the big button; the answers are then links.
  // Once booked it is a status line, so the first answer is the big button again.
  const lead = screen === "talk" || screen === "wrap" ? props.offers?.[0] : undefined;
  const big = (lead && lead.state !== "booked") || props.pasting ? null : props.chips[0] ?? null;
  const firstLink = big === null ? 0 : 1;
  const links = props.chips.slice(firstLink);
  const otherOffers = (props.offers ?? []).filter((offer) => offer !== lead);
  const hear = props.hear && !voice.muted;
  // The first line shows at once; every later one fades in whole, with no word-by-word wait.
  const [firstLine] = useState(props.line);
  const listening = voice.phase === "listening";
  const youHint =
    screen === "talk" && !props.you && !listening && !props.typing && props.chips.length === 0 && !props.offers?.length
      ? voice.supported && !props.note
        ? "Tap Talk or the keyboard to answer."
        : "Tap the keyboard to answer."
      : "";
  const today = useToday();
  const streak = progress?.streak ?? 0;
  const signedIn = screen !== null && screen !== "signed-out" && screen !== "setup";
  // The goals panel (Nov 4): the left column beside every screen on a laptop, the home under the hello on a phone. With
  // no goal yet, the home is the front door instead.
  const planGoals = signedIn ? props.goals ?? [] : [];
  const panelOn = planGoals.length > 0;
  const frontDoor = home && screen === "ready" && !panelOn;
  // Sources are found for the step the desk shows (after a Done, the one up next).
  const sourceStep = next ?? top ?? (screen === "checkin" ? openSteps(goal)[0] : props.proposed) ?? null;
  // A goal open (Vi, Nov 4): a laptop's three columns, the goals | the open goal | "For this goal".
  const aside = desk && !planning && goal ? goal : null;

  const mainRef = useRef<HTMLElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pressed = useRef(false);
  const answersKey = `${screen}:${desk}:${next?.id}:${hear}:${props.chips.join("|")}:${frontDoor}:${(props.offers ?? []).map((offer) => offer.state).join(",")}`;
  // Home, a plan's desk or a card: each opens at the top of the page, so the strip and the hello are never scrolled off.
  const place = desk ? `desk:${planning?.title ?? goal?.id}` : home ? "home" : "card";
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [place]);
  useEffect(() => {
    // After a press, keyboard focus follows the screen to its big button (on the home, its first option), unless it
    // went somewhere else on its own.
    const area = mainRef.current;
    const button = area?.querySelector<HTMLElement>("textarea[data-retry], .pill-big, .choice");
    if (!pressed.current || !button) return;
    pressed.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || area?.contains(active)) button.focus({ preventScroll: true });
  }, [answersKey]);
  useEffect(() => {
    // No answers (the home, the front door): nothing to bring clear, so the view stays at its top.
    const clear = () => keepClear(pillsRef.current, mainRef.current);
    clear();
    // Once more after the card's rise and a Done's slide settle (300 ms), which can still push the answers down (round 2,
    // Nov 4: Keep going sat half under the dock on a phone).
    const again = setTimeout(clear, 450);
    return () => clearTimeout(again);
    // Zeno's line too: a 2-3 line reply under a running step pushes Done down without changing the answers (round 4).
  }, [answersKey, props.line]);
  // The dock's real height is the page's bottom space: html's scroll padding and the goals panel's height read it from
  // --dock, never a fixed guess. When it grows (the text box opens, a long message wraps, a line shows over Talk) the
  // screen's answers come clear of it, the front door's Make a plan too (Nov 4: the box covered Zeno's answers).
  const dockRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const root = document.documentElement;
    let last = dock.offsetHeight;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--dock", `${dock.offsetHeight}px`);
      const pills = pillsRef.current;
      if (dock.offsetHeight > last) keepClear(pills?.childElementCount ? pills : mainRef.current?.querySelector("[data-answers]"), mainRef.current, true);
      last = dock.offsetHeight;
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--dock");
    };
  }, [signedIn]);

  // The person's words; the text box itself docks above the dock (Nov 4), never on the card.
  const youLine =
    props.you || youHint || listening ? (
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
  const openGoal = (goalId: string) => {
    pressed.current = true;
    on.openGoal(goalId);
  };
  const addGoal = (text: string) => {
    pressed.current = true;
    on.addGoal?.(text);
  };
  const fromApp = (i: number) => {
    if (props.busy) return;
    pressed.current = true;
    on.fromApp?.(i);
  };
  const pickPhoto = () => photoRef.current?.click();
  // Focus goes back to the keyboard button without scrolling: the dock sits inside html's scroll padding.
  const closeBox = () => {
    typeRef.current?.focus({ preventScroll: true });
    on.closeTyping();
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
    // .page: with the goals panel, a laptop's grid (the panel left, main, and with a goal open "For this goal" right)
    // and a phone's home under the hello.
    <div
      className="page flex min-h-dvh flex-col overflow-x-clip bg-desk text-ink"
      data-panel={panelOn || undefined}
      data-away={!home || undefined}
      data-ws={panelOn || undefined}
    >
      <header className="mx-auto flex w-full max-w-[1224px] items-center justify-between gap-2 px-4 pt-4 sm:px-8 sm:pt-6 short:pt-3">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* The mark goes home, to the goals; Today opens the sheet with Today and Week (Nov 4: "Desk" meant nothing). */}
          {signedIn ? (
            <button type="button" onClick={goHome} className="flex items-center gap-2 rounded-xl text-[24px] font-bold" aria-label="Zeno: all goals">
              {mark}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[24px] font-bold">{mark}</div>
          )}
          {signedIn && (
            <button type="button" onClick={() => on.sheet("today")} className="link" data-lead>
              Today
            </button>
          )}
          {signedIn && (
            <button type="button" onClick={() => on.sheet("apps")} className="link">
              Apps
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

        {frontDoor ? (
          <>
            {/* No goal yet (Nov 4): what Zeno does, a box to write a goal in, and Make a plan. */}
            <FrontDoor hello={props.hello} line={props.line} words={props.addWords ?? null} note={props.note} onAdd={addGoal} onPhoto={pickPhoto}>
              {youLine}
            </FrontDoor>
            <div className="w-full max-w-[760px]">
              <Suggestions title="From your apps" rows={props.appRows ?? []} onPick={fromApp} limit={5} />
              <Suggestions rows={props.suggestions ?? []} onPick={choose} />
            </div>
          </>
        ) : home ? (
          <>
            {/* The hello (Vi, Nov 3): her name and Zeno's line on one card; the goals are in the panel. */}
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
                {/* Coming back (Nov 4): where she left off, with Start under the card. */}
                {props.resume && (
                  <>
                    <p>
                      <span className="hand">{props.resume.started ? "Pick up where you left off:" : "Start here:"}</span>
                    </p>
                    {/* Its minutes are on Start under the card (Nov 4: beside a long step they collided with the goal's line). */}
                    <p className="font-bold">{props.resume.step}</p>
                    <p>
                      <span className="hand text-ink-2">
                        {props.resume.goal}
                        {props.resume.due && today ? ` · ${dueLine(props.resume.due, today)}` : ""}
                      </span>
                    </p>
                  </>
                )}
                {screen !== null && youLine}
              </div>
            </article>

          </>
        ) : (
          <>
            {desk && (
              <div className="mt-2 w-full max-w-[760px] sm:mt-4 short:mt-0">
                {/* A phone's way back to the goals; a laptop's goals panel stands in for it. */}
                <button type="button" onClick={goHome} className="back link -ml-1">
                  ← Goals
                </button>
              </div>
            )}
            {desk && (
              // Sticky across the desk column (Nov 4): the goal and its bar stay in view in Focus and after a Done, and
              // the page scrolls under them. Opaque to its edge (round 7: the Next card's words showed through a fade).
              <div data-strip className="sticky top-0 z-20 -mx-4 w-[calc(100%+2rem)] bg-desk px-4 pt-2 pb-1">
                <div className="mx-auto max-w-[760px]">
                  <GoalStrip
                    title={planning?.title ?? goal?.title ?? ""}
                    due={planning ? planning.due : goal?.due}
                    rhythm={planning ? null : goal?.rhythm}
                    steps={planning ? [] : steps}
                    marked={marked}
                    caption={barCaption(done, steps.length, screen === "checkin" && Boolean(props.celebrate), Boolean(goal?.rhythm) && !planning)}
                    today={today}
                    // Not in Focus, where Done finishes the step and a "Mark done" beside it would read as the same.
                    onClose={
                      planning || !on.closeGoal || screen === "focus"
                        ? undefined
                        : (how) => {
                            if (props.busy) return;
                            pressed.current = true;
                            on.closeGoal?.(how);
                          }
                    }
                  />
                </div>
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
                  <p className="absolute top-[96px] w-full text-center text-ink-2">{doneCount} done</p>
                </div>
              )}
            </div>

            {props.celebrate && progress && progress.week.length > 0 && screen === "checkin" && <StreakRow progress={progress} />}
            {planning && screen === "ready" && (planning.view ?? <p className="mt-2 text-center text-ink-2">Muse, Meta&apos;s AI, is making the steps.</p>)}

            {/* Under a step card, Zeno's line (in Focus, or about the step it proposes: never only spoken, Nov 4) and the
                person's words. */}
            {!lineOnCard && (
              <div className="caption mt-2 w-full max-w-[640px] text-center text-[20px] leading-8 empty:hidden">
                {props.line && (
                  <p className={top && props.quiet ? "text-ink-2" : undefined}>
                    <Said key={props.line} text={props.line} fade={props.line !== firstLine} />
                    {props.lineUndo && (
                      <>
                        {" "}
                        <button type="button" data-undo onClick={() => on.unskip?.()} className="link">
                          Undo
                        </button>
                      </>
                    )}
                  </p>
                )}
                {youLine}
              </div>
            )}
          </>
        )}

        <p role="status" className="mt-2 max-w-[560px] text-center text-ink-2 empty:mt-0">
          {/* The front door says its own note under its box, where she is looking (review, Nov 4). */}
          {screen === "signed-out" && props.signInFailed ? "Google sign-in didn't finish. Try again." : frontDoor ? null : props.note}
        </p>

        {/* On a goal's desk, Skip and Adjust sit beside Start on a laptop (Vi, Nov 4). */}
        <div
          ref={pillsRef}
          data-row={(next !== null && !lead) || undefined}
          className="answers mt-4 flex w-full max-w-[760px] flex-col items-center gap-2 empty:mt-0 sm:mt-6 short:mt-4"
        >
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
              {/* Before Music, whose stations open on their own row after it. Mounted after a Done too, so its window can
                  show what is next. */}
              <span className={props.stuck ? "hidden" : "contents"}>
                <FocusPop {...props} />
                <FocusMusic active={screen === "focus"} />
              </span>
            </div>
          )}
        </div>

        {/* A laptop's home points at the goals beside it, under Start when she is coming back. */}
        {home && !frontDoor && panelOn && (
          <p className="mt-6 text-center text-ink-2 max-lg:hidden">{props.resume ? "Or pick another goal on the left." : "Pick a goal on the left, or add one."}</p>
        )}

        {/* The steps and the materials stay below the step, in Focus too, and a quiet word on who made the steps. */}
        {desk && !planning && goal && (
          <>
            <StepsList key={goal.id} steps={steps} marked={marked} onPropose={screen === "ready" ? on.propose : undefined} />
            <p className="mt-10 w-full max-w-[760px] text-[16px] text-ink-2">Steps by Muse, Meta&apos;s AI</p>
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
          <>
            {/* Google's unverified-app screen comes next (the app is published, not verified), so say the way through. */}
            <p className="mt-3 max-w-[560px] text-center text-ink-2">
              Zeno is a new hackathon app, so Google says it isn&apos;t verified yet. Choose Advanced, then Go to Zeno.
            </p>
            <p className="mt-6 max-w-[560px] text-center text-ink-2">
              Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
            </p>
          </>
        )}
      </main>

      {aside && (
        <GoalAside
          key={sourceStep?.id ?? "none"}
          goal={aside}
          step={sourceStep}
          materials={props.materials}
          brief={props.brief}
          today={props.today}
          offer={props.deskOffer}
          apps={props.appItems}
          onAddDoc={on.addDoc}
          onBook={() => props.deskOffer && on.book(props.deskOffer.key)}
          onUndo={() => props.deskOffer && on.unbook(props.deskOffer.key)}
        />
      )}

      {panelOn && (
        <GoalsPanel
          goals={planGoals}
          suggestions={props.suggestions ?? []}
          openId={desk && !planning ? goal?.id ?? null : null}
          proposed={props.proposed}
          today={today}
          words={props.addWords ?? null}
          onAdd={addGoal}
          onCancel={() => on.closeAdd?.()}
          onOpen={openGoal}
          onSuggest={choose}
          onPhoto={pickPhoto}
          apps={props.appRows}
          onApp={fromApp}
          onApps={() => on.sheet("apps")}
        />
      )}

      {/* First sign-in is one card and its links, so the dock waits until it's done. Talk, and typing one tap beside it. */}
      {signedIn && (
        <nav ref={dockRef} aria-label="Zeno" className="dock">
          {props.toast && (
            <p role="status" className="mb-2 flex items-center gap-1 px-4 text-center text-ink-2">
              {props.toast.text}
              {props.toast.undo && (
                <button type="button" data-answer data-lead data-undo onClick={() => on.undo?.()} className="link">
                  Undo
                </button>
              )}
            </p>
          )}
          {/* The text box docks here, in one place above Talk, and closes after Send (Nov 4). */}
          {props.typing && (
            <Write
              key={props.retry ?? ""}
              initial={props.retry ?? ""}
              busy={props.busy}
              onSend={(text) => {
                on.send(text);
                closeBox();
                window.scrollTo({ top: 0 });
              }}
              onClose={closeBox}
            />
          )}
          <div className="dock-row">
            <VoiceRing phase={voice.phase} levelRef={voice.levelRef} blocked={blocked} onClick={on.talk} />
            {/* A blocked mic makes typing the way that still works, so it fills in ink. */}
            <button
              ref={typeRef}
              type="button"
              onClick={props.typing ? on.closeTyping : on.type}
              className="kbd"
              aria-label="Type to Zeno"
              aria-expanded={props.typing}
              data-lead={blocked || undefined}
            >
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
        goals={props.held ?? props.goals}
        onGoal={on.openGoal}
        onDeadline={on.openDeadline}
        onAdd={on.mailGoal}
        onStep={on.addStep}
        onFollowUp={on.followUp}
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
      <SheetPanel open={props.sheet === "apps"} title="Your apps" onClose={() => on.sheet(null)}>
        {props.sheet === "apps" && (
          <YourApps
            key={props.canvas?.account ?? ""}
            account={props.canvas?.account ?? null}
            google={{ mail: props.today?.sources.email === "ok", calendar: props.today?.sources.calendar === "ok" }}
            canvas={Boolean(props.canvas?.linked)}
            connected={props.connected}
            onGoogle={on.signIn}
            onCanvas={() => on.sheet("canvas")}
            onChange={() => on.appsChanged?.()}
          />
        )}
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

// The text box, a slip of card docked above Talk (Nov 4): Send closes it, so Zeno's answer has the screen.
function Write({ initial, busy, onSend, onClose }: { initial: string; busy: boolean; onSend(text: string): void; onClose(): void }) {
  const box = useRef<HTMLTextAreaElement>(null);
  // Focused without scrolling: the dock is inside html's scroll padding, so a plain focus scrolls the page to its end.
  useEffect(() => box.current?.focus({ preventScroll: true }), []);
  const send = () => {
    const text = box.current?.value.trim();
    // While Zeno is busy the words wait in the box for the next Enter, so two turns never run at once.
    if (!box.current || !text || busy) return;
    onSend(text);
  };
  return (
    <div className="slip">
      <textarea
        ref={box}
        rows={1}
        enterKeyHint="send"
        defaultValue={initial}
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
      <button type="button" aria-disabled={busy} onClick={send} className="pill pill-small pill-ink shrink-0">
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
