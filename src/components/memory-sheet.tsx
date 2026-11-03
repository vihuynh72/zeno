"use client";

import { useRef } from "react";
import type { Memory } from "@/lib/day";
import type { VaultFact } from "@/lib/vault";
import { groupFacts, type Fact } from "@/components/day-flow";

// What Zeno remembers, grouped, with this device's private facts in their groups. Forget is a quiet × per row.
export default function MemorySheet({
  memories,
  device,
  onForget,
  onAdd,
  onRetry,
}: {
  memories: Memory[] | "loading" | "error";
  device: VaultFact[];
  onForget(fact: Fact): void;
  onAdd(text: string): Promise<boolean>;
  onRetry(): void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const facts: Fact[] = [
    ...device.map((fact) => ({ id: fact.id, text: fact.text, group: fact.group, device: true })),
    ...(Array.isArray(memories) ? memories.map((memory) => ({ id: memory.id, text: memory.text, group: memory.group, device: false })) : []),
  ];
  const add = () => {
    const text = box.current?.value.trim();
    if (!box.current || !text) return box.current?.focus();
    // A line is one memory; longer or multi-line text is read as pasted notes (guided-day.tsx addMemory). The box
    // clears at once, and a save that failed puts the text back unless something new was typed meanwhile.
    void onAdd(text).then((saved) => {
      if (!saved && box.current && !box.current.value) box.current.value = text;
    });
    box.current.value = "";
  };

  return (
    <>
      <p className="text-ink-2">What Zeno remembers about you. Forget anything, any time.</p>
      <form
        className="mini flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        {/* 8000 is POST /api/import's limit. Enter saves, as in the type box; Shift+Enter starts a new line. */}
        <textarea
          ref={box}
          rows={1}
          maxLength={8000}
          className="add max-h-60 min-w-0 flex-1 resize-none py-2.5 field-sizing-content"
          aria-label="Add something Zeno should remember"
          placeholder="Add something or paste notes"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="submit" className="pill pill-small">
          Save
        </button>
      </form>
      {memories === "loading" && facts.length === 0 ? (
        <p className="text-ink-2">Loading…</p>
      ) : memories === "error" && facts.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p>I couldn&apos;t load what I remember just now.</p>
          <button type="button" onClick={onRetry} className="pill pill-small">
            Try again
          </button>
        </div>
      ) : facts.length === 0 ? (
        <p className="mini">
          <span className="lines block">Nothing yet. As you use Zeno, what it learns shows up here.</span>
        </p>
      ) : (
        // One ruled card per group, a fact per line, like Today's cards.
        groupFacts(facts).map((entry) => (
          <section key={entry.group} aria-label={entry.name} className="mini">
            <h3 className="text-[20px] leading-8 font-bold">{entry.name}</h3>
            <ul className="lines mt-2">
              {entry.facts.map((fact) => (
                <li key={fact.id} className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 wrap-break-word">
                    {fact.text}
                    {fact.device && <span className="block text-[18px] text-ink-2">Only on this device</span>}
                  </p>
                  <button type="button" onClick={() => onForget(fact)} className="forget" aria-label={`Forget: ${fact.text}`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {memories === "error" && facts.length > 0 && <p className="text-ink-2">Some of what I remember didn&apos;t load.</p>}
    </>
  );
}
