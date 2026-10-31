"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import type { DayEmail, DayEvent, Goal, Memory, SourceState, Step } from "@/lib/day";
import type { VoicePhase } from "@/lib/use-voice";
import { cardSize, clock, openSteps, STAGE_OF, STAGES, type Screen } from "@/components/day-flow";
import Desk from "@/components/desk";
import VoiceRing from "@/components/voice-ring";

export type Sheet = "today" | "memory" | null;

export type Today = {
  events: DayEvent[];
  emails: DayEmail[];
  unreadEmail: number;
  sources: { calendar: SourceState; email: SourceState; goals: SourceState };
};

export type DayViewProps = {
  screen: Screen | null; // null while the day loads
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
  voice: { phase: VoicePhase; levelRef: { current: number }; muted: boolean; supported: boolean };
  on: {
    primary(): void;
    secondary(): void;
    talk(): void;
    type(): void;
    closeTyping(): void;
    send(text: string): void;
    sheet(sheet: Sheet): void;
    forget(id: string): void;
    retryMemory(): void;
    mute(): void;
    signIn(): void;
    signOut(): void;
  };
};

const PILLS: Record<Screen, string[]> = {
  "signed-out": ["Sign in with Google"],
  ready: ["Start my day"],
  brief: ["Yes, let's start", "Not now"],
  talk: [],
  plan: ["Start this step", "Change the plan"],
  focus: ["Done", "I'm stuck"],
  checkin: ["Keep going", "Stop for now"],
};

const everySecond = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};

// Wall clock in whole seconds; 0 on the server so the first paint matches.
function useNow() {
  return useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000) * 1000, () => 0);
}

export default function DayView(props: DayViewProps) {
  const { screen, goal, voice, on } = props;
  const steps = openSteps(goal);
  const step = (screen === "plan" || screen === "focus") && steps[0] ? steps[0] : null;
  const finished = screen === "checkin" && goal !== null && steps.length === 0;
  const lineOnCard = !step && !finished;
  const cardText = finished ? `You finished ${goal.title}.` : lineOnCard ? props.line : step?.title ?? "";
  const doneCount = (goal?.steps.filter((s) => s.status === "done").length ?? 0) - (props.leaving ? 1 : 0);
  const labels = finished ? ["Pick another thing", "Stop for now"] : screen ? PILLS[screen] : [];
  // A line Zeno is about to say stays hidden until the voice starts, then appears word by word.
  const mode = voice.muted ? "all" : voice.phase === "speaking" ? "pace" : voice.phase === "thinking" ? "wait" : "all";
  const listening = voice.phase === "listening";
  // With a voice note showing (mic blocked, no speech input), point at typing only.
  const youHint =
    screen === "talk" && !props.you && !listening
      ? voice.supported && !props.note
        ? "Tap Talk or Type to answer."
        : "Tap Type to answer."
      : "";

  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const shownScreen = useRef(screen);
  useEffect(() => {
    // When the pill someone pressed goes away with its screen, keep keyboard focus nearby.
    if (shownScreen.current !== screen && document.activeElement === document.body) {
      pillsRef.current?.querySelector("button")?.focus();
    }
    shownScreen.current = screen;
  }, [screen]);

  const youLine = props.typing ? (
    <Write
      onSend={on.send}
      onClose={() => {
        typeRef.current?.focus();
        on.closeTyping();
      }}
    />
  ) : props.you || youHint || listening ? (
    <p>
      <span className={`hand text-ink-2 ${listening ? "pen" : ""}`}>{props.you || youHint}</span>
    </p>
  ) : null;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-desk text-ink">
      <header className="mx-auto flex w-full max-w-[1224px] items-center justify-between px-4 pt-4 sm:px-8 sm:pt-6 short:pt-3">
        <div className="flex items-center gap-2 text-[24px] font-bold">
          <svg width="36" height="36" viewBox="0 0 34 34" aria-hidden="true">
            <rect width="34" height="34" rx="9" fill="var(--ink)" />
            <path d="M10 11h14l-9.5 12H24" fill="none" stroke="var(--card)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Zeno
        </div>
        <div className="flex min-h-14 items-center gap-2 sm:gap-4">
          <Clock />
          {screen && screen !== "signed-out" && (
            <button
              type="button"
              onClick={on.mute}
              className="flex h-14 items-center gap-2 rounded-full px-4 font-medium transition-colors hover:bg-card"
            >
              <Icon name={voice.muted ? "sound-off" : "sound"} />
              <span className="max-sm:sr-only">{voice.muted ? "Sound off" : "Sound on"}</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-2 sm:pb-4 short:pb-2">
        <Progress at={screen ? STAGE_OF[screen] : -1} />

        <p className="sr-only" aria-live="polite">
          {props.line}
        </p>

        <div className="relative mt-6 mb-6 w-full max-w-[760px] short:mt-4 short:mb-4">
          {(screen !== "plan" || steps.length < 2) &&
            [3, 2, 1].map((n) => (
              <i key={n} className="edge" style={{ inset: `${8 * n}px ${16 * n}px ${-8 * n}px` }} />
            ))}

          <article
            key={step ? `${screen}:${step.id}:${step.title}` : finished ? "finished" : screen ?? "loading"}
            className="card rise z-10"
            data-size={cardSize(cardText)}
            // A step card only needs room for its title (and the timer, or a blank row for the stamp), so the roadmap fits under it.
            style={step ? ({ "--rows": screen === "plan" ? 2 : step.minutes ? 3 : 4 } as CSSProperties) : undefined}
          >
            <div className="lines">
              {step ? (
                <>
                  <p>
                    {screen === "plan" && step.minutes ? <span className="mins">{step.minutes} min</span> : null}
                    {step.title}
                  </p>
                  {screen === "focus" && step.minutes ? (
                    <p className="mt-(--lh)">
                      <Countdown minutes={step.minutes} startedAt={step.startedAt} />
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {cardText && (
                    <p className={screen ? undefined : "text-ink-2"}>
                      {finished ? cardText : <Said key={cardText} text={cardText} mode={mode} />}
                    </p>
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
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {s.minutes ? <span className="shrink-0 font-mono text-ink-2">{s.minutes} min</span> : null}
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

          {(screen === "plan" || screen === "focus" || screen === "checkin") && doneCount > 0 && (
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

        {!lineOnCard && (
          <div className="caption mt-2 w-full max-w-[640px] text-center text-[20px] leading-8">
            {props.line && (
              <p>
                <Said key={props.line} text={props.line} mode={mode} />
              </p>
            )}
            {youLine}
          </div>
        )}

        <p role="status" className="mt-2 max-w-[560px] text-center text-ink-2 empty:mt-0">
          {screen === "signed-out" && props.signInFailed ? "Google sign-in didn't finish. Try again." : props.note}
        </p>

        <div ref={pillsRef} className="mt-4 flex w-full max-w-[760px] flex-wrap justify-center gap-4 empty:mt-0 sm:mt-6 sm:gap-6 short:mt-4">
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              // aria-disabled, not disabled, so a waiting pill keeps keyboard focus.
              aria-disabled={props.busy}
              onClick={props.busy ? undefined : i === 0 ? on.primary : on.secondary}
              className={`pill max-sm:flex-auto max-sm:px-4 max-sm:text-[18px] sm:min-w-[240px] ${i === 0 ? "pill-ink" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        {screen === "signed-out" && (
          <p className="mt-6 max-w-[560px] text-center text-ink-2">
            Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
          </p>
        )}
      </main>

      {screen && screen !== "signed-out" && (
        <nav aria-label="Zeno" className="flex justify-center gap-2 pb-4 sm:gap-4 sm:pt-2 short:pt-0">
          <VoiceRing phase={voice.phase} levelRef={voice.levelRef} onClick={on.talk} />
          <DockButton ref={typeRef} label="Type" icon="type" onClick={on.type} />
          <DockButton label="Today" icon="today" onClick={() => on.sheet("today")} />
          <DockButton label="Memory" icon="memory" onClick={() => on.sheet("memory")} />
        </nav>
      )}

      <Desk open={props.sheet === "today"} today={props.today} goal={goal} onClose={() => on.sheet(null)} onSignIn={on.signIn} />
      <SheetPanel open={props.sheet === "memory"} title="Memory" onClose={() => on.sheet(null)}>
        {props.sheet === "memory" && (
          <>
            <MemorySheet memories={props.memories} onForget={on.forget} onRetry={on.retryMemory} onSignOut={on.signOut} />
            {/* A failed Forget says so here, where the person is looking. */}
            <p role="status">{props.note}</p>
          </>
        )}
      </SheetPanel>
    </div>
  );
}

function Progress({ at }: { at: number }) {
  return (
    <ol
      aria-label={at >= 0 ? `Step ${at + 1} of ${STAGES.length}: ${STAGES[at]}` : "Your day, in four steps"}
      className="mt-4 grid w-full max-w-[760px] grid-cols-4 gap-2 sm:mt-6 sm:gap-6 short:mt-3"
    >
      {STAGES.map((name, i) => (
        <li
          key={name}
          aria-current={i === at ? "step" : undefined}
          className={`border-t-4 pt-2 ${i <= at ? "border-ink" : "border-track"} ${
            i === at ? "font-bold whitespace-nowrap" : "text-ink-2"
          }`}
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
    <p className="font-medium">
      {/* Phones keep just the time; the date would crowd out Sound. */}
      <span className="max-sm:hidden">
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

// Zeno's words. aria-hidden because the live region above the card reads the same line once.
// shortcut: words keep a steady speaking pace, not real word timings; switch to TTS timepoints if the voice hook exposes them
function Said({ text, mode }: { text: string; mode: "all" | "pace" | "wait" }) {
  return (
    <span className={mode === "all" ? undefined : mode} aria-hidden="true">
      {text.split(/\s+/).map((word, i) => (
        <span key={i} style={{ "--i": i } as CSSProperties}>
          {word}{" "}
        </span>
      ))}
    </span>
  );
}

function Write({ onSend, onClose }: { onSend(text: string): void; onClose(): void }) {
  return (
    <textarea
      autoFocus
      rows={1}
      enterKeyHint="send"
      className="write"
      aria-label="Type to Zeno"
      placeholder="Type here, then press Enter"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          const text = event.currentTarget.value.trim();
          if (text) onSend(text);
        }
      }}
    />
  );
}

function DockButton({ label, icon, onClick, ref }: { label: string; icon: IconName; onClick: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-2 rounded-2xl font-medium sm:w-[88px]">
      <span className="grid h-[120px] place-items-center short:h-24">
        <span className="knob">
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
    if (open && !dialog.open) dialog.showModal();
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
          <h2 className="text-[28px] leading-10 font-bold">{title}</h2>
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

function MemorySheet({
  memories,
  onForget,
  onRetry,
  onSignOut,
}: {
  memories: Memory[] | "loading" | "error";
  onForget: (id: string) => void;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <p className="text-ink-2">What Zeno remembers about how you like to work. Forget anything, any time.</p>
      {memories === "loading" ? (
        <p className="text-ink-2">Loading…</p>
      ) : memories === "error" ? (
        <div className="flex flex-col items-start gap-4">
          <p>I couldn&apos;t load what I remember just now.</p>
          <button type="button" onClick={onRetry} className="pill pill-small">
            Try again
          </button>
        </div>
      ) : memories.length === 0 ? (
        <p className="mini">
          <span className="lines block">Nothing yet. When you tell Zeno how you like to work, it&apos;ll remember it here.</span>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {memories.map((memory) => (
            <li key={memory.id} className="mini flex flex-col items-start gap-2">
              <p className="lines w-full">{memory.text}</p>
              <button type="button" onClick={() => onForget(memory.id)} className="pill pill-small">
                Forget<span className="sr-only">: {memory.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onSignOut} className="pill pill-small mt-auto self-start">
        Sign out
      </button>
    </>
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
