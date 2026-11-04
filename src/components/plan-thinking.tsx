"use client";

import { useState } from "react";
import type { PlanQuestion } from "@/lib/day";

// Vi's planning flow (Nov 4): for a goal too vague to plan well, Zeno asks one or two tap questions, one at a time; then
// "Muse is planning…" shows only what is really happening while it plans, and, once the plan is back, Muse's own lines
// one by one, each with a check, then its first step. Shown under the planning card (day-view.tsx planning.view);
// nothing here talks to the server.

// Between lines as the plan opens.
export const REVEAL_MS = 200;
// How long the whole reveal of `lines` takes, with a moment to read the last line before the plan opens.
export const revealMs = (lines: number) => (lines + 1) * REVEAL_MS + 700;

// One of Zeno's questions (the card says it): its answers as equal chips, since none is the suggested one, and
// "Something else", which opens a box for her own words. Its buttons are answers (data-answer), as every answer is.
export function PlanAsk({ question, onAnswer }: { question: PlanQuestion; onAnswer(answer: string): void }) {
  const [typing, setTyping] = useState(false);
  const [words, setWords] = useState("");
  const send = () => {
    const answer = words.trim();
    if (answer) onAnswer(answer.slice(0, 120));
  };
  return (
    <div className="mt-4 flex w-full max-w-[640px] flex-col items-center gap-2">
      <div role="group" aria-label={question.question} className="flex flex-wrap justify-center gap-2">
        {question.options.map((option) => (
          <button key={option} type="button" data-answer onClick={() => onAnswer(option)} className="pill pill-small">
            {option}
          </button>
        ))}
      </div>
      {typing ? (
        <form
          className="flex w-full max-w-[480px] items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="choice add-box min-w-0 flex-1">
            <div className="lines">
              <input
                autoFocus
                maxLength={120}
                enterKeyHint="go"
                value={words}
                onChange={(event) => setWords(event.target.value)}
                className="write"
                aria-label={question.question}
                placeholder="In your words"
              />
            </div>
          </div>
          <button type="submit" data-answer className="pill pill-small pill-ink">
            OK
          </button>
        </form>
      ) : (
        <div className="links">
          <button type="button" data-answer onClick={() => setTyping(true)} className="link">
            Something else
          </button>
        </div>
      )}
    </div>
  );
}

// "Muse is planning…". While it plans, `live` holds only what is really happening, like "Checking your calendar" when a
// calendar is connected. When the plan is back, `lines` are Muse's own, each with a check, REVEAL_MS apart, then its first
// step: never a line Muse didn't write.
export function PlanThinking({ live, lines, first }: { live: string[]; lines?: string[]; first?: string }) {
  const at = (index: number) => ({ animationDelay: `${index * REVEAL_MS}ms` });
  // A left-aligned list in a steady column centered under the card, so lines arriving never shift it.
  return (
    <section aria-live="polite" className="mx-auto mt-4 w-full max-w-[520px] text-[18px] leading-7">
      <p className="font-bold">Muse is planning…</p>
      <ul className="mt-1 flex flex-col gap-1">
        {lines
          ? [
              ...lines.map((line, index) => (
                <li key={`${index}:${line}`} className="fade" style={at(index)}>
                  <span aria-hidden="true">✓ </span>
                  {line}
                </li>
              )),
              first && (
                <li key="first" className="fade font-bold" style={at(lines.length)}>
                  <span aria-hidden="true">→ </span>First: {first}
                </li>
              ),
            ]
          : live.map((line) => (
              <li key={line} className="text-ink-2">
                {line}…
              </li>
            ))}
      </ul>
    </section>
  );
}
