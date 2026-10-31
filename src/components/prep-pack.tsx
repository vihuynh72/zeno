"use client";

import { useState } from "react";
import type { PrepResponse, PrepSource, Step } from "@/lib/day";

// Stable, so it runs once, when the first source found by a tap appears.
const focusOnMount = (link: HTMLAnchorElement | null) => link?.focus();

// A few web sources for the step about to start, found when the person asks. Key it by step id.
export default function PrepPack({ step }: { step: Step }) {
  const [sources, setSources] = useState<PrepSource[]>(step.prep ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "failed" | "found">("idle");

  async function find() {
    setStatus("loading");
    try {
      const response = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id }),
      });
      const data = (await response.json()) as PrepResponse;
      if (data.state !== "ok" || data.sources.length === 0) throw new Error(data.state);
      setSources(data.sources);
      setStatus("found");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <section aria-label="Sources for this step" className="mt-6 flex w-full max-w-[640px] flex-col items-center">
      {sources.length > 0 ? (
        <ul className="flex w-full flex-col gap-3">
          {sources.map((source, i) => (
            <li key={i} className="mini">
              <div className="lines">
                <a
                  ref={i === 0 && status === "found" ? focusOnMount : undefined}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-4"
                >
                  {source.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <p className="text-ink-2">{source.why}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        // aria-disabled, not disabled, so the chip keeps keyboard focus while Zeno looks.
        <button
          type="button"
          aria-disabled={status === "loading"}
          onClick={() => status !== "loading" && find()}
          className="pill pill-small pill-quiet"
        >
          Find sources
        </button>
      )}
      <p role="status" className="mt-3 text-center text-ink-2 empty:mt-0">
        {status === "loading" ? "Looking for good sources…" : status === "failed" ? "Couldn't find sources just now. Try again?" : ""}
      </p>
    </section>
  );
}
