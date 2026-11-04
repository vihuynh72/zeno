"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Goal, Step } from "@/lib/day";
import { goalRow, panelGoals, type CardRow, type PanelRow } from "@/components/day-flow";

// The goals panel (Nov 4, docs/PLAN-NOV4-GOALS.md): every open goal by due date, "+ Add goal" under them, then
// Suggestions. A laptop's left column beside the open goal's desk; a phone's home under the hello. Nothing here talks
// to the server: the page's handlers do.

// "Type your goal here" over an errand and a school example, each on one line of a 360px phone (round 5: three of ten
// pressed Make a plan with the box empty; round 3: older and non-student testers read school-only examples as "for
// young people").
const EXAMPLES = "Type your goal here, like:\n– Call the bank this week\n– Study for Thursday's exam";

// Enter makes the plan, Shift+Enter starts a new line, Escape closes the box (the panel's only). In a box for a list
// (`lines`, the front door: its examples are one goal a line), Enter starts a new line and Cmd or Ctrl+Enter makes the
// plan (round 2, Nov 4: Enter sent a nurse's first line, and her second goal was never made).
function onKeys(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void, close?: () => void, lines = false) {
  if (event.key === "Escape" && close) {
    event.preventDefault();
    close();
  } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && (!lines || event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    submit();
  }
}

// The words in a box, or the box focused again when it is empty.
function take(box: HTMLTextAreaElement | null, onAdd: (text: string) => void) {
  const text = box?.value.trim();
  if (text) onAdd(text);
  else box?.focus();
}

type PanelProps = {
  goals: Goal[]; // the open plans, in any order
  suggestions: CardRow[] | null;
  openId: string | null; // the goal whose desk is open, highlighted
  proposed?: Step | null; // the open goal's step on its desk, so its row names the same Next
  today: string;
  words: string | null; // words whose plan failed, back in the box
  onAdd(text: string): void;
  onCancel(): void;
  onOpen(goalId: string): void;
  onSuggest(index: number): void;
  onHide(id: string): void;
  onKeep(id: string): void;
  onMemory(): void;
  onPhoto(): void;
  apps?: PanelRow[]; // From your apps, shown while the box is open (Nov 4)
  onApp?(index: number): void; // one of them becomes a goal
  onApps?(): void; // "Connect your apps": the Your apps sheet
};

export default function GoalsPanel(props: PanelProps) {
  const { goals, suggestions, openId, proposed, today, words, onAdd, onCancel, onOpen, onSuggest, onPhoto, apps = [], onApp, onApps } = props;
  const [adding, setAdding] = useState(false);
  const [round, setRound] = useState(0); // a new box (closed) once an app's item became the goal
  const pickApp = (i: number) => {
    setRound((n) => n + 1);
    setAdding(false);
    onApp?.(i);
  };
  return (
    <aside aria-label="Goals" className="panel">
      <h2 className="text-[20px] leading-8 font-bold">Goals</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {panelGoals(goals).map((goal) => {
          const open = goal.id === openId;
          const row = goalRow(goal, today, open ? proposed : null);
          const done = goal.steps.filter((step) => step.status === "done").length;
          return (
            <li key={goal.id}>
              <button type="button" data-answer onClick={() => onOpen(goal.id)} aria-current={open || undefined} className="choice">
                <span className="lines block">
                  {/* The count inside the title: a direct child of .lines is position: relative, so it would take a line. */}
                  <span className="line-clamp-2 font-bold">
                    {row.title}
                    <span className="sr-only">
                      , {done} of {goal.steps.length} steps done.
                    </span>
                  </span>
                  {/* Fills only with finished steps (Nov 4: a red first segment read as progress already made). */}
                  <span className="meter" aria-hidden="true">
                    {goal.steps.map((step) => (
                      <i key={step.id} data-done={step.status === "done" || undefined} />
                    ))}
                  </span>
                  {/* The next step takes one line in a laptop's column, so 3-4 goals fit above the dock (live, Nov 4: the third
                      was cut at 772px); the due line may wrap to two, so "58 days left" is never cut (round 5). */}
                  {row.line && <span className="line-clamp-2 text-[18px] lg:line-clamp-1">{row.line}</span>}
                  {row.when && <span className="line-clamp-2 text-[18px] text-ink-2">{row.when}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* Under the last goal, and on a laptop held at the column's foot while the goals scroll (Vi, Nov 4: "Is there a way
          to add a goal?"). Keyed by the words, so failed ones open the box again with them in it. */}
      <div className="add">
        <AddBox key={`${round}:${words ?? ""}`} words={words} onAdd={onAdd} onCancel={onCancel} onPhoto={onPhoto} onToggle={setAdding} />
        {onApps && (
          <button type="button" data-answer onClick={onApps} className="link mt-1 text-ink-2">
            Connect your apps
          </button>
        )}
      </div>
      {(adding || words !== null) && onApp && <FromYourApps rows={apps} onPick={pickApp} limit={5} />}
      <Suggestions rows={suggestions} onPick={onSuggest} onHide={props.onHide} onKeep={props.onKeep} onMemory={props.onMemory} />
    </aside>
  );
}

// "+ Add goal": a tap opens the box in place at once, with no AI turn; Make a plan sends the words.
// Its buttons are answers (data-answer): a tap while Talk listens never sends the half-heard words.
type AddBoxProps = { words: string | null; onAdd(text: string): void; onCancel(): void; onPhoto(): void; onToggle(open: boolean): void };
function AddBox({ words, onAdd, onCancel, onPhoto, onToggle }: AddBoxProps) {
  const [open, setOpenHere] = useState(words !== null);
  const setOpen = (on: boolean) => {
    setOpenHere(on);
    onToggle(on);
  };
  const box = useRef<HTMLTextAreaElement>(null);
  const whole = useRef<HTMLDivElement>(null);
  // The open box, with Make a plan, in view above Talk, and above a phone's keyboard as it opens (round 7: Make a plan sat
  // half under the dock). html's scroll padding is the dock, so "nearest" scrolls only when it is covered.
  useEffect(() => {
    if (!open) return;
    const clear = () => requestAnimationFrame(() => whole.current?.scrollIntoView({ block: "nearest" }));
    clear();
    visualViewport?.addEventListener("resize", clear);
    return () => visualViewport?.removeEventListener("resize", clear);
  }, [open]);
  const close = () => {
    setOpen(false);
    onCancel();
  };
  if (!open) {
    return (
      <button type="button" data-answer onClick={() => setOpen(true)} className="add-goal mt-2">
        + Add goal
      </button>
    );
  }
  const submit = () =>
    take(box.current, (text) => {
      setOpen(false);
      onAdd(text);
    });
  return (
    <div ref={whole} className="mt-2">
      <div className="choice add-box">
        <div className="lines">
          <textarea
            ref={box}
            autoFocus
            rows={2}
            enterKeyHint="go"
            defaultValue={words ?? ""}
            className="write"
            aria-label="What do you want to get done?"
            placeholder="What do you want to get done?"
            onKeyDown={(event) => onKeys(event, submit, close)}
          />
        </div>
      </div>
      <button type="button" data-answer onClick={submit} className="pill pill-small pill-ink mt-2 w-full">
        Make a plan
      </button>
      <div className="links mt-1">
        <button type="button" data-answer onClick={onPhoto} className="link">
          Add from a photo
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" data-answer onClick={close} className="link">
          Cancel
        </button>
      </div>
    </div>
  );
}

// The front door (zero goals): the hello, one line on what Zeno does, and a visible box with examples from school and
// life; Make a plan sends the words (POST /api/goal/add). A plan that couldn't be made brings the words back with its
// note under the box, and the box takes focus (data-retry). children: the person's words while they talk instead.
type DoorProps = { hello?: string; line: string; words: string | null; note: string | null; onAdd(text: string): void; onPhoto(): void; children?: ReactNode };
export function FrontDoor({ hello, line, words, note, onAdd, onPhoto, children }: DoorProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const make = useRef<HTMLButtonElement>(null);
  const [empty, setEmpty] = useState(false);
  // With a mouse, the caret waits in the box, so it reads as a box to type in (round 3: "it looks like printed paper");
  // a phone's keyboard opens only on a tap.
  useEffect(() => {
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) box.current?.focus({ preventScroll: true });
  }, []);
  const submit = () => {
    setEmpty(!box.current?.value.trim());
    take(box.current, onAdd);
  };
  return (
    <>
      <article className="card hello door rise z-10 mt-6 w-full max-w-[760px] short:mt-4">
        <div className="lines">
          {hello && <h1 className="font-bold">{hello}</h1>}
          <p>
            <span className="hand">{line}</span>
          </p>
          <p>
            <label htmlFor="goal-words" className="hand font-bold">
              What do you want to get done?
            </label>
          </p>
          <textarea
            key={words ?? ""}
            ref={box}
            id="goal-words"
            enterKeyHint="enter"
            defaultValue={words ?? ""}
            data-retry={words !== null || undefined}
            className="write"
            placeholder={EXAMPLES}
            onKeyDown={(event) => onKeys(event, submit, undefined, true)}
            // The box grows as she writes: Make a plan stays clear of the dock (round 2, Nov 4: it slid half under it on a
            // phone). html's scroll padding is the dock, so "nearest" scrolls only when it is covered.
            onInput={() => {
              setEmpty(false);
              requestAnimationFrame(() => make.current?.scrollIntoView({ block: "nearest" }));
            }}
          />
          <p role="status" className="text-ink-2 empty:hidden">
            {note ?? (empty ? "Type a goal first, like the examples." : null)}
          </p>
          {children}
        </div>
      </article>
      {/* data-answers: kept clear of the dock when it grows (day-view.tsx). */}
      <div data-answers className="mt-4 flex w-full max-w-[760px] flex-col items-center gap-2 sm:mt-6 short:mt-4">
        <button ref={make} type="button" data-answer onClick={submit} className="pill pill-ink pill-big">
          Make a plan
        </button>
        <div className="links">
          <button type="button" data-answer onClick={onPhoto} className="link">
            Add from a photo
          </button>
        </div>
      </div>
    </>
  );
}

// The Suggestions stack (Vi, Nov 4): the page passes the top 3 she hasn't hidden today. A row is one tap (a goal's next
// step, mail to answer, a deadline or an app's item to plan) with ✕ to hide it for today; what Zeno noticed has Keep and
// ✕ (Forget) instead. A row fades out, the rows under it move up, and focus goes to the row that took its place.
// rows null: the day isn't read yet, so nothing claims she is caught up.
type StackProps = { rows: CardRow[] | null; onPick(index: number): void; onHide(id: string): void; onKeep(id: string): void; onMemory(): void };
export function Suggestions({ rows, onPick, onHide, onKeep, onMemory }: StackProps) {
  const [gone, setGone] = useState<string[]>([]);
  const list = useRef<HTMLUListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  if (rows === null) return null;
  const leave = (id: string, i: number, then: (id: string) => void) => {
    const done = () => {
      then(id);
      setGone((ids) => ids.filter((one) => one !== id));
      requestAnimationFrame(() => (list.current?.querySelectorAll<HTMLElement>("[data-hide]")[i] ?? heading.current)?.focus());
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
    setGone((ids) => [...ids, id]);
    setTimeout(done, 200);
  };
  return (
    <section aria-labelledby="suggestions" className="mt-6 w-full">
      <h2 ref={heading} id="suggestions" tabIndex={-1} className="text-[20px] leading-8 font-bold outline-none">
        Suggestions
      </h2>
      {rows.length === 0 && <p className="mt-2 text-ink-2">You&apos;re all caught up.</p>}
      <ul ref={list} className="feed mt-2">
        {rows.map((row, i) => (
          <li key={row.id} className="fade" data-gone={gone.includes(row.id) || undefined}>
            <div>
              <div className="relative pb-2">
                {row.noticed ? (
                  <div className="choice">
                    <span className="lines block">
                      <span className="block pr-8 wrap-break-word">{row.title}</span>
                      <span className="block">
                        <button type="button" data-answer onClick={() => leave(row.id, i, onKeep)} className="keep">
                          Keep
                        </button>
                      </span>
                    </span>
                  </div>
                ) : (
                  <button type="button" data-answer onClick={() => onPick(i)} className="choice">
                    <span className="lines block">
                      <span className="flex items-baseline justify-between gap-4 pr-8">
                        <span className="line-clamp-2 min-w-0 font-bold">{row.title}</span>
                        <span className="shrink-0 text-ink-2">{row.aside}</span>
                      </span>
                      {row.line && <span className="block truncate text-[18px]">{row.line}</span>}
                      {row.when && <span className="block truncate text-[18px] text-ink-2">{row.when}</span>}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  data-answer
                  data-hide
                  onClick={() => leave(row.id, i, onHide)}
                  className="hide"
                  aria-label={row.noticed ? "Forget this" : `Hide ${row.title} for today`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" data-answer onClick={onMemory} className="link -ml-1">
        What Zeno remembers
      </button>
    </section>
  );
}

// "From your apps" (Nov 4) under the open add box: what connected apps have waiting, `limit` shown until Show all.
export function FromYourApps({ rows, onPick, title = "From your apps", limit = Infinity }: { rows: PanelRow[]; onPick(index: number): void; title?: string; limit?: number }) {
  const id = useId();
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-6 w-full">
      <h2 id={id} className="text-[20px] leading-8 font-bold">
        {title}
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.slice(0, all ? undefined : limit).map((row, i) => (
          <li key={`${i}:${row.title}`}>
            <button type="button" data-answer onClick={() => onPick(i)} className="choice">
              <span className="lines block">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="line-clamp-2 min-w-0 font-bold">{row.title}</span>
                  <span className="shrink-0 text-ink-2">{row.aside}</span>
                </span>
                {row.line && <span className="block truncate text-[18px]">{row.line}</span>}
                {row.when && <span className="block truncate text-[18px] text-ink-2">{row.when}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!all && rows.length > limit && (
        <button type="button" onClick={() => setAll(true)} className="link mt-1">
          Show all {rows.length}
        </button>
      )}
    </section>
  );
}
