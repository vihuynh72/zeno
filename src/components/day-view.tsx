"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import type { DayEvent, Goal, Memory, SourceState, Step } from "@/lib/day";
import type { VoicePhase } from "@/lib/use-voice";
import { cardSize, clock, openSteps, sayMode, STAGE_OF, STAGES, type SayMode, type Screen } from "@/components/day-flow";
import VoiceRing from "@/components/voice-ring";

export type Sheet = "today" | "memory" | null;

export type Today = {
  events: DayEvent[];
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
  chips: Chip[]; // the answers to tap on the ready, talk and setup cards
  dots: { at: number; of: number } | null; // setup progress, shown instead of the four steps
  list: string[] | null; // lines written under Zeno's line (what setup will remember)
  pasting: boolean; // the setup card takes pasted notes
  hear: boolean; // the browser held Zeno's voice back until a tap
  voice: { phase: VoicePhase; levelRef: { current: number }; muted: boolean; supported: boolean };
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
    forget(id: string): void;
    retryMemory(): void;
    mute(): void;
    signIn(): void;
    signOut(): void;
  };
};

// The ready, talk and setup cards answer with chips instead.
const PILLS: Partial<Record<Screen, string[]>> = {
  "signed-out": ["Sign in with Google"],
  plan: ["Start this step", "Change the plan"],
  focus: ["Done", "I'm stuck"],
  checkin: ["Keep going", "Stop for now"],
};

const STATUS: Record<Step["status"], string> = { done: "Done", doing: "Doing", todo: "To do", skipped: "Skipped" };

const SOURCE_NOTE: Record<Exclude<SourceState, "ok">, (name: string) => string> = {
  "no-access": (name) => `Zeno can't see your ${name} right now. Sign in again to allow it.`,
  error: (name) => `Zeno couldn't read your ${name} just now.`,
  "not-configured": (name) => `Your ${name} isn't connected yet.`,
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
  const tapFirst = screen === "ready" || screen === "talk" || screen === "setup";
  const labels = finished ? ["Pick another thing", "Stop for now"] : screen ? PILLS[screen] ?? [] : [];
  // The line on screen and how it came in, so Zeno starting or stopping to talk never animates it again.
  const [shown, setShown] = useState<{ line: string; mode: SayMode }>({ line: props.line, mode: "all" });
  const mode = sayMode(shown, props.line, voice.phase === "speaking" && !voice.muted, voice.phase === "thinking" && !voice.muted);
  if (shown.line !== props.line || shown.mode !== mode) setShown({ line: props.line, mode });
  const listening = voice.phase === "listening";
  // With a voice note showing (mic blocked, no speech input), point at typing only.
  const youHint =
    screen === "talk" && !props.you && !listening && props.chips.length === 0
      ? voice.supported && !props.note
        ? "Tap Talk or Type to answer."
        : "Tap Type to answer."
      : "";

  const pillsRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  const answersKey = `${screen}:${props.dots?.at}:${props.hear}:${(tapFirst ? props.chips.map((c) => c.label) : labels).join("|")}`;
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
      <Write
        busy={props.busy}
        onSend={on.send}
        onClose={() => {
          typeRef.current?.focus();
          on.closeTyping();
        }}
      />
    </>
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
        {props.dots ? <Dots {...props.dots} /> : <Progress at={screen ? STAGE_OF[screen] : -1} />}

        <p className="sr-only" aria-live="polite">
          {props.line}
        </p>

        <div className="relative mt-6 mb-6 w-full max-w-[760px] short:mt-4 short:mb-4">
          {(screen !== "plan" || steps.length < 2) &&
            [3, 2, 1].map((n) => (
              <i key={n} className="edge" style={{ inset: `${8 * n}px ${16 * n}px ${-8 * n}px` }} />
            ))}

          <article
            // The shell and the ready card are one card, so the first paint never jumps; each setup card is a new one.
            key={step ? `${screen}:${step.id}:${step.title}` : finished ? "finished" : screen === "setup" ? `setup:${props.dots?.at}` : screen ?? "ready"}
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
                  {cardText && <p>{finished ? cardText : <Said key={cardText} text={cardText} mode={mode} />}</p>}
                  {props.list && (
                    <ul>
                      {props.list.map((item) => (
                        <li key={item}>
                          <span className="hand">{item}</span>
                        </li>
                      ))}
                    </ul>
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

        <div
          ref={pillsRef}
          // Phones get two chips a row, so four answers and the dock still fit one screen.
          className={`mt-4 w-full max-w-[760px] empty:mt-0 sm:mt-6 short:mt-4 ${
            tapFirst ? "grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-4" : "flex flex-wrap justify-center gap-4 sm:gap-6"
          }`}
        >
          {tapFirst
            ? props.chips.map((chip, i) => (
                <button
                  key={chip.label}
                  type="button"
                  aria-disabled={props.busy}
                  onClick={() => {
                    if (props.busy) return;
                    pressed.current = true;
                    on.chip(i);
                  }}
                  className={`pill max-sm:odd:last:col-span-2 ${
                    chip.tone === "ink" ? "pill-ink" : chip.tone === "quiet" ? "pill-quiet" : ""
                  }`}
                >
                  {chip.label}
                </button>
              ))
            : labels.map((label, i) => (
                <button
                  key={label}
                  type="button"
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
              ))}
        </div>

        {screen === "signed-out" && (
          <p className="mt-6 max-w-[560px] text-center text-ink-2">
            Zeno reads today&apos;s calendar and recent email to help. It never sends or changes anything without asking.
          </p>
        )}
      </main>

      {/* Setup is one tap per card, so the dock waits until it's done. */}
      {screen && screen !== "signed-out" && screen !== "setup" && (
        <nav aria-label="Zeno" className="flex justify-center gap-2 pb-4 sm:gap-4 sm:pt-2 short:pt-0">
          <VoiceRing phase={voice.phase} levelRef={voice.levelRef} onClick={on.talk} />
          <DockButton ref={typeRef} label="Type" icon="type" onClick={on.type} />
          <DockButton label="Today" icon="today" onClick={() => on.sheet("today")} />
          <DockButton label="Memory" icon="memory" onClick={() => on.sheet("memory")} />
        </nav>
      )}

      <SheetPanel open={props.sheet !== null} title={props.sheet === "memory" ? "Memory" : "Today"} onClose={() => on.sheet(null)}>
        {props.sheet === "today" && <TodaySheet today={props.today} goal={goal} onSignIn={on.signIn} />}
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
function Said({ text, mode }: { text: string; mode: SayMode }) {
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

function DockButton({ label, icon, onClick, ref }: { label: string; icon: IconName; onClick: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-2 rounded-2xl font-medium sm:w-[88px]">
      <span className="grid h-[120px] place-items-center short:h-24">
        <span className="knob tap">
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

function TodaySheet({ today, goal, onSignIn }: { today: Today | null; goal: Goal | null; onSignIn: () => void }) {
  if (!today) {
    return <p className="text-ink-2">I couldn&apos;t load today just now. Reload the page to try again.</p>;
  }
  const { calendar, email } = today.sources;
  const time = (event: DayEvent) =>
    event.allDay ? "All day" : new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <section className="mini">
        <h3 className="text-[20px] leading-8 font-bold">Calendar</h3>
        <ul className="lines">
          {calendar !== "ok" ? (
            <li className="text-ink-2">{SOURCE_NOTE[calendar]("calendar")}</li>
          ) : today.events.length === 0 ? (
            <li className="text-ink-2">Nothing on your calendar today.</li>
          ) : (
            today.events.map((event) => (
              <li key={`${event.start}:${event.title}`} className="flex items-baseline gap-4">
                <span className="w-[112px] shrink-0 font-mono leading-none whitespace-nowrap text-ink-2">{time(event)}</span>
                <span>{event.title}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {email !== "ok" ? (
        <section className="mini">
          <p className="lines text-ink-2">{SOURCE_NOTE[email]("email")}</p>
        </section>
      ) : today.unreadEmail > 0 ? (
        <section className="mini">
          <p className="lines">
            <span className="font-mono">{today.unreadEmail}</span> unread email{today.unreadEmail === 1 ? "" : "s"}
          </p>
        </section>
      ) : null}

      {goal && goal.steps.length > 0 && (
        <section className="mini">
          <h3 className="text-[20px] leading-8 font-bold">{goal.title}</h3>
          <ul className="lines">
            {goal.steps.map((s) => (
              <li key={s.id} className="flex items-baseline gap-4">
                <span className={`w-[72px] shrink-0 leading-none ${s.status === "doing" ? "font-bold" : "text-ink-2"}`}>
                  {STATUS[s.status]}
                </span>
                <span className={s.status === "done" || s.status === "skipped" ? "text-ink-2 line-through" : ""}>{s.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(calendar === "no-access" || email === "no-access") && (
        <button type="button" onClick={onSignIn} className="pill pill-small self-start">
          Sign in again
        </button>
      )}
    </>
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
