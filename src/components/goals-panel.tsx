"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Goal, Step } from "@/lib/day";
import { goalRow, panelGoals, type PanelRow } from "@/components/day-flow";

// The goals panel (Nov 4, docs/PLAN-NOV4-GOALS.md): "+ Add a goal" on top, every open goal by due date, then
// Suggestions. A laptop's left column beside the open goal's desk; a phone's home under the hello. Nothing here talks
// to the server: the page's handlers do.

// School and life, each on one line of a 360px phone (the plan's longer ones wrapped and read as five examples); a dash
// starts each, so one that still wraps reads as one.
const EXAMPLES = "– Run a 5K by January\n– Finish my site by Friday\n– Study for Thursday's exam";

// Enter makes the plan, Shift+Enter starts a new line, Escape closes the box (the panel's only).
function onKeys(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void, close?: () => void) {
  if (event.key === "Escape" && close) {
    event.preventDefault();
    close();
  } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
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
  suggestions: PanelRow[];
  openId: string | null; // the goal whose desk is open, highlighted
  proposed?: Step | null; // the open goal's step on its desk, so its row names the same Next
  today: string;
  words: string | null; // words whose plan failed, back in the box
  onAdd(text: string): void;
  onOpen(goalId: string): void;
  onSuggest(index: number): void;
  onPhoto(): void;
};

export default function GoalsPanel({ goals, suggestions, openId, proposed, today, words, onAdd, onOpen, onSuggest, onPhoto }: PanelProps) {
  return (
    <aside aria-label="Goals" className="panel">
      <h2 className="text-[20px] leading-8 font-bold">Goals</h2>
      {/* Keyed by the words, so failed ones open the box again with them in it. */}
      <AddBox key={words ?? ""} words={words} onAdd={onAdd} onPhoto={onPhoto} />
      <ul className="mt-2 flex flex-col gap-2">
        {panelGoals(goals).map((goal) => {
          const open = goal.id === openId;
          const row = goalRow(goal, today, open ? proposed : null);
          const done = goal.steps.filter((step) => step.status === "done").length;
          return (
            <li key={goal.id}>
              <button type="button" onClick={() => onOpen(goal.id)} aria-current={open || undefined} className="choice">
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
                  {row.line && <span className="line-clamp-2 text-[18px]">{row.line}</span>}
                  {row.when && <span className="block truncate text-[18px] text-ink-2">{row.when}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Suggestions rows={suggestions} onPick={onSuggest} />
    </aside>
  );
}

// "+ Add a goal": a tap opens the box in place at once, with no AI turn; Make a plan sends the words.
function AddBox({ words, onAdd, onPhoto }: { words: string | null; onAdd(text: string): void; onPhoto(): void }) {
  const [open, setOpen] = useState(words !== null);
  const box = useRef<HTMLTextAreaElement>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="add-goal mt-2">
        + Add a goal
      </button>
    );
  }
  const submit = () =>
    take(box.current, (text) => {
      setOpen(false);
      onAdd(text);
    });
  return (
    <div className="mt-2">
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
            onKeyDown={(event) => onKeys(event, submit, () => setOpen(false))}
          />
        </div>
      </div>
      <button type="button" onClick={submit} className="pill pill-small pill-ink mt-2 w-full">
        Make a plan
      </button>
      <div className="links mt-1">
        <button type="button" onClick={onPhoto} className="link">
          Add from a photo
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => setOpen(false)} className="link">
          Cancel
        </button>
      </div>
    </div>
  );
}

// The front door (zero goals): the hello, one line on what Zeno does, and a visible box with examples from school and
// life; Make a plan sends the words (POST /api/goal/add). children: the person's words while they talk instead.
export function FrontDoor({ hello, line, words, onAdd, onPhoto, children }: { hello?: string; line: string; words: string | null; onAdd(text: string): void; onPhoto(): void; children?: ReactNode }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const submit = () => take(box.current, onAdd);
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
            enterKeyHint="go"
            defaultValue={words ?? ""}
            className="write"
            placeholder={EXAMPLES}
            onKeyDown={(event) => onKeys(event, submit)}
          />
          {children}
        </div>
      </article>
      <div className="mt-4 flex w-full max-w-[760px] flex-col items-center gap-2 sm:mt-6 short:mt-4">
        <button type="button" onClick={submit} className="pill pill-ink pill-big">
          Make a plan
        </button>
        <div className="links">
          <button type="button" onClick={onPhoto} className="link">
            Add from a photo
          </button>
        </div>
      </div>
    </>
  );
}

// Deadlines with no plan yet ("Plan it") and email that asks something ("Answer Prof. Patel"), each one tap.
export function Suggestions({ rows, onPick }: { rows: PanelRow[]; onPick(index: number): void }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="suggestions" className="mt-6 w-full">
      <h2 id="suggestions" className="text-[20px] leading-8 font-bold">
        Suggestions
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row, i) => (
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
    </section>
  );
}
