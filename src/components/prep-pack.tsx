"use client";

import { useEffect, useState } from "react";
import type { PrepResponse, PrepSource, Step } from "@/lib/day";

// Stable, so it runs once, when the first source found by a search appears.
const focusOnMount = (link: HTMLAnchorElement | null) => link?.focus();

// POST /api/prep: up to 3 sources for the step, or null when there are none just now.
async function findSources(stepId: string): Promise<PrepSource[] | null> {
  try {
    const response = await fetch("/api/prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    const data = (await response.json()) as PrepResponse;
    return data.state === "ok" && data.sources.length > 0 ? data.sources : null;
  } catch {
    return null;
  }
}

// A few web sources for the step in focus, opened from its Sources link: it looks at once unless the step already has
// some. Key it by step id.
export default function PrepPack({ step }: { step: Step }) {
  const [sources, setSources] = useState<PrepSource[]>(step.prep ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "failed" | "found">(step.prep?.length ? "idle" : "loading");

  // Each look (on opening, or Try again) is status "loading" until its answer lands.
  useEffect(() => {
    if (status !== "loading") return;
    let live = true;
    void findSources(step.id).then((found) => {
      if (!live) return;
      if (found) setSources(found);
      setStatus(found ? "found" : "failed");
    });
    return () => {
      live = false;
    };
  }, [status, step.id]);

  return (
    <section aria-label="Sources for this step" className="mt-6 flex w-full max-w-[640px] flex-col items-center">
      {sources.length > 0 && (
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
      )}
      <p role="status" className="text-center text-ink-2">
        {status === "loading" ? "Looking for good sources…" : status === "failed" ? "Couldn't find sources just now." : ""}
      </p>
      {status === "failed" && (
        <button type="button" onClick={() => setStatus("loading")} className="link">
          Try again
        </button>
      )}
    </section>
  );
}
