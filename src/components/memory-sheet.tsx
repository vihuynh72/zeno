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
  onAdd(text: string): void;
  onRetry(): void;
}) {
  const box = useRef<HTMLInputElement>(null);
  const facts: Fact[] = [
    ...device.map((fact) => ({ id: fact.id, text: fact.text, group: fact.group, device: true })),
    ...(Array.isArray(memories) ? memories.map((memory) => ({ id: memory.id, text: memory.text, group: memory.group, device: false })) : []),
  ];
  const add = () => {
    const text = box.current?.value.trim();
    if (!box.current || !text) return box.current?.focus();
    onAdd(text.slice(0, 200));
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
        <input ref={box} maxLength={200} className="add min-w-0 flex-1" aria-label="Add something Zeno should remember" placeholder="Add something" />
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
          <span className="lines block">Nothing yet. When you tell Zeno how you like to work, it&apos;ll remember it here.</span>
        </p>
      ) : (
        groupFacts(facts).map((entry) => (
          <section key={entry.group} aria-label={entry.name} className="flex flex-col gap-2">
            <h3 className="text-[20px] leading-8 font-bold">{entry.name}</h3>
            <ul className="flex flex-col gap-2">
              {entry.facts.map((fact) => (
                <li key={fact.id} className="mini flex items-start gap-2">
                  <p className="lines min-w-0 flex-1">
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
