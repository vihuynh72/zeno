"use client";

import { useEffect, useRef } from "react";
import type { VoicePhase } from "@/lib/use-voice";

// A studio clock's 60 second dots around the Talk button, lit in margin red by whoever is talking.
// Rounded so the server's and the browser's trigonometry render the same markup.
const DOTS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i * Math.PI) / 30;
  return { x: (60 + 54 * Math.sin(angle)).toFixed(2), y: (60 - 54 * Math.cos(angle)).toFixed(2) };
});

// How far dot i sits from 12 o'clock, either way round.
const fromTop = (i: number) => Math.min(i, 60 - i);

// Reduced motion: one still arc per state.
const STILL: Record<VoicePhase, (i: number) => number> = {
  idle: () => 0,
  listening: (i) => (i < 15 ? 1 : 0),
  thinking: (i) => (i < 4 ? 1 : 0),
  speaking: (i) => (fromTop(i) <= 10 ? 1 : 0),
};

const LABEL: Record<VoicePhase, string> = {
  idle: "Talk",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const HINT: Record<VoicePhase, string> = {
  idle: "",
  listening: ", tap to stop",
  thinking: ", tap to stop",
  speaking: ", tap to interrupt",
};

export default function VoiceRing({
  phase,
  levelRef,
  onClick,
}: {
  phase: VoicePhase;
  levelRef: { current: number };
  onClick: () => void;
}) {
  const dotsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const dots = Array.from(dotsRef.current?.children ?? []) as SVGCircleElement[];
    const shown: number[] = [];
    const paint = (light: (i: number) => number) => {
      dots.forEach((dot, i) => {
        const value = light(i);
        if (shown[i] === value) return;
        shown[i] = value;
        dot.style.fill = value > 0 ? "var(--red)" : "";
        dot.style.opacity = value > 0 ? String(value) : "";
      });
    };

    if (phase === "idle" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(STILL[phase]);
      return;
    }

    let level = 0;
    let frame = requestAnimationFrame(function draw(time) {
      // Ease toward the live level so the ring breathes instead of flickering.
      level += (Math.min(1, Math.max(0, levelRef.current)) - level) * 0.2;
      if (phase === "listening") {
        const start = Math.floor(time / 120) % 60; // a slow sweep, one lap in 7.2s
        const lit = 10 + Math.round(level * 50); // a sixth of the ring even in silence, so listening reads as on
        paint((i) => ((i - start + 60) % 60 < lit ? 1 : 0));
      } else if (phase === "thinking") {
        const head = Math.floor(time / 80) % 60;
        paint((i) => {
          const behind = (head - i + 60) % 60;
          return behind < 4 ? 1 - behind * 0.22 : 0;
        });
      } else {
        const reach = Math.round(level * 30);
        paint((i) => (fromTop(i) <= reach ? 1 : 0));
      }
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, levelRef]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[120px] flex-col items-center gap-2 rounded-2xl font-bold"
    >
      <span className="relative grid h-[120px] w-[120px] place-items-center short:size-24">
        <svg viewBox="0 0 120 120" className="dots absolute inset-0" aria-hidden="true">
          <g ref={dotsRef}>
            {DOTS.map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r="1.9" />
            ))}
          </g>
        </svg>
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ink text-card">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
        </span>
      </span>
      <span>
        {LABEL[phase]}
        <span className="sr-only">{HINT[phase]}</span>
      </span>
    </button>
  );
}
