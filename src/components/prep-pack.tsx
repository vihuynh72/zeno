"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasBrief, PrepResponse, PrepSource, Step } from "@/lib/day";

// Stable, so it runs once, when the first source found by a search appears; the pack's own scroll brings it into view.
const focusOnMount = (link: HTMLAnchorElement | null) => link?.focus({ preventScroll: true });

// POST /api/prep: up to 3 sources for the step, or null when there are none just now. A Canvas assignment's brief
// rides along, so the search can use its instructions.
async function findSources(stepId: string, canvas: CanvasBrief | undefined): Promise<PrepSource[] | null> {
  try {
    const response = await fetch("/api/prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, canvas }),
    });
    const data = (await response.json()) as PrepResponse;
    return data.state === "ok" && data.sources.length > 0 ? data.sources : null;
  } catch {
    return null;
  }
}

// A few web sources for the step in focus, opened from its Sources link: it looks at once unless the step already has
// some. Key it by step id.
export default function PrepPack({ step, canvas }: { step: Step; canvas?: CanvasBrief }) {
  const [sources, setSources] = useState<PrepSource[]>(step.prep ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "failed" | "found">(step.prep?.length ? "idle" : "loading");
  const pack = useRef<HTMLElement>(null);

  // Each look (on opening, or Try again) is status "loading" until its answer lands.
  useEffect(() => {
    if (status !== "loading") return;
    let live = true;
    void findSources(step.id, canvas).then((found) => {
      if (!live) return;
      if (found) setSources(found);
      setStatus(found ? "found" : "failed");
    });
    return () => {
      live = false;
    };
  }, [status, step.id, canvas]);

  // Opened or answered: the pack scrolls clear of the sticky dock, as the answers do, but never so far that the step's
  // card leaves the top of the screen.
  useEffect(() => {
    const bottom = pack.current?.getBoundingClientRect().bottom ?? 0;
    const dockTop = document.querySelector(".dock")?.getBoundingClientRect().top ?? innerHeight;
    const cardTop = document.querySelector(".card")?.getBoundingClientRect().top ?? 0;
    const by = Math.min(bottom - (dockTop - 16), cardTop - 16);
    if (by > 0) scrollBy({ top: by, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [status]);

  return (
    <section ref={pack} aria-label="Sources for this step" className="mt-6 flex w-full max-w-[640px] flex-col items-center">
      {sources.length > 0 && (
        <div className="mini w-full">
          <ul className="lines">
            {sources.map((source, i) => (
              <li key={i}>
                <a
                  ref={i === 0 && status === "found" ? focusOnMount : undefined}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-bold underline underline-offset-4"
                >
                  {source.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <p className="truncate text-ink-2">{source.why}</p>
              </li>
            ))}
          </ul>
        </div>
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
