"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { clock } from "@/components/day-flow";
import type { DayViewProps } from "@/components/day-view";
import { popCard, type PopCard } from "@/components/pop-card";
import { Icon } from "@/components/icons";

// The pop-out focus window (docs/PLAN-NOV3-APPS.md §3; Vi: comfortable, never in the way): a small always-on-top index
// card with the step, its stopwatch, the check-in line and Done, where the browser has Document Picture-in-Picture.
// Only a tap on "Pop out" opens it. It shows what the page shows and taps the page's own answers, so its Done and Keep
// going run what the page's buttons run. It closes when the step ends, a few seconds after the plan's last step, or
// when the person closes it.

// Not in TypeScript's DOM types yet.
type PipApi = { window: Window | null; requestWindow(options: { width: number; height: number }): Promise<Window> };
const pipApi = () => (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture;

// Tall enough for a two-line step, the stopwatch, the quiet line and Done at Chrome's 125% pop-out zoom (live, Nov 3: at
// 320x200 the card scrolled and hid Done). The browser may keep a size the person gave it before.
const SIZE = { width: 340, height: 260 };
const LAST_MS = 4000; // how long "That's all of <goal>." shows before the window closes
const subscribeNever = () => () => {};

// The page's index card at window size (.card sizes itself for the page): a smaller hand on closer rules, the margin
// line, and the card is the whole window, its button at the bottom.
const CARD = {
  "--fs": "18px",
  "--fs2": "15px",
  "--lh": "26px",
  "--rows": 0,
  "--margin-x": "28px",
  "--pad-l": "40px",
  "--pad-r": "16px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: "100dvh",
  padding: "8px var(--pad-r) 12px var(--pad-l)",
  borderRadius: 0,
  boxShadow: "none",
} as CSSProperties;

type Props = Pick<DayViewProps, "screen" | "goal" | "line" | "quiet" | "timer" | "chips" | "busy" | "on">;

export default function FocusPop({ screen, goal, line, quiet, timer, chips, busy, on }: Props) {
  const supported = useSyncExternalStore(subscribeNever, () => Boolean(pipApi()), () => false);
  const [pip, setPip] = useState<Window | null>(null); // the window, once its styles have loaded
  const link = useRef<HTMLButtonElement>(null);
  const card = popCard(screen, goal, chips);
  const kind = card?.kind ?? null;

  // Leaving the page (signing out) closes the window, and so does this component going.
  useEffect(() => {
    const close = () => pipApi()?.window?.close();
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      close();
    };
  }, []);

  // The step ended (Stop for now, Switch goal, another desk, signed out): it closes at once. After the plan's last step
  // its line shows first, timed by the window itself, since a hidden tab's timers are slowed.
  useEffect(() => {
    if (!pip || kind === "step" || kind === "next") return;
    if (kind === null) return pip.close();
    const id = pip.setTimeout(() => pip.close(), LAST_MS);
    return () => pip.clearTimeout(id);
  }, [pip, kind]);

  async function toggle() {
    if (pip) return pip.close();
    // Asked for in the tap itself, before any wait: the browser opens it only for a user gesture.
    const win = await pipApi()?.requestWindow(SIZE).catch(() => null);
    if (!win) return;
    win.addEventListener("pagehide", () => setPip((open) => (open === win ? null : open)));
    await dress(win, link.current);
    if (!win.closed) setPip(win);
  }

  return (
    <>
      {/* One of the Focus links where the browser can pop out: an icon alone (round 9), its words in the tooltip. */}
      {supported && screen === "focus" && (
        <button
          ref={link}
          type="button"
          className="link min-w-11 justify-center"
          aria-label="Pop out"
          title="Pop out"
          aria-pressed={pip !== null}
          data-lead={pip ? true : undefined}
          onClick={() => void toggle()}
        >
          <Icon name="popOut" />
        </button>
      )}
      {pip && card && createPortal(<Card card={card} win={pip} line={line} quiet={quiet} timer={timer} busy={busy} onAnswer={on.chip} />, pip.document.body)}
    </>
  );
}

// The page's stylesheets by absolute URL (copying their rules would break next/font's relative font URLs) and <html>'s
// class, which holds the font variables. Resolves once they load, or after 3 s, so a slow sheet never keeps it blank.
function dress(win: Window, from: Element | null) {
  const html = win.document.documentElement;
  html.className = document.documentElement.className;
  html.lang = document.documentElement.lang;
  // Light and dark follow the page: the system's, or the one the /preview gallery pins.
  const theme = from?.closest("[data-theme]")?.getAttribute("data-theme");
  if (theme) html.dataset.theme = theme;
  win.document.title = "Zeno";
  const loads = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (sheet) => {
    const copy = win.document.createElement("link");
    copy.rel = "stylesheet";
    copy.href = sheet.href;
    win.document.head.append(copy);
    return new Promise((done) => (copy.onload = copy.onerror = done));
  });
  return Promise.race([Promise.all(loads), new Promise((done) => setTimeout(done, 3000))]);
}

type CardProps = { card: NonNullable<PopCard>; win: Window; line: string; quiet?: boolean; timer?: number | null; busy: boolean; onAnswer(index: number): void };

// In Focus the step, its stopwatch and Zeno's quiet line; after a Done, Zeno's line. One button: the page's own answer.
function Card({ card, win, line, quiet, timer, busy, onAnswer }: CardProps) {
  const answer = card.kind === "last" ? -1 : card.answer;
  return (
    <article className="card" style={CARD}>
      <div className="lines">
        {card.kind === "step" ? (
          <>
            <p className="line-clamp-2" title={card.step.title}>
              {card.step.title}
            </p>
            <Stopwatch win={win} startedAt={card.step.startedAt} planned={timer ?? card.step.minutes} />
            {line && (
              <p className={`line-clamp-2 ${quiet ? "text-ink-2" : ""}`}>
                <span className="hand">{line}</span>
              </p>
            )}
          </>
        ) : (
          <p className="line-clamp-4">{line}</p>
        )}
      </div>
      {answer >= 0 && (
        // aria-disabled, not disabled, so a waiting button keeps keyboard focus, as on the page.
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => {
            if (!busy) onAnswer(answer);
          }}
          className="pill pill-ink"
          style={{ width: "100%", minHeight: 40, marginTop: "auto" }}
        >
          {card.kind === "step" ? "Done" : "Keep going"}
        </button>
      )}
    </article>
  );
}

// Counts up from the step's start like the page's stopwatch, on the window's own timer: a hidden tab's are slowed.
function Stopwatch({ win, startedAt, planned }: { win: Window; startedAt: string | null; planned: number | null }) {
  const everySecond = useCallback(
    (onChange: () => void) => {
      const id = win.setInterval(onChange, 1000);
      return () => win.clearInterval(id);
    },
    [win],
  );
  const now = useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000) * 1000, () => 0);
  const started = startedAt ? Date.parse(startedAt) : NaN;
  return (
    <p>
      <span className="timer">{clock(Number.isNaN(started) ? 0 : (now - started) / 1000)}</span>
      <span className="sr-only"> so far</span>
      {planned ? (
        <span className="planned" style={{ marginLeft: 12, fontSize: 14 }}>
          planned <span className="font-mono">{planned} min</span>
        </span>
      ) : null}
    </p>
  );
}
