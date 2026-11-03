"use client";

import { type FormEvent, Fragment, useState } from "react";
import type { CanvasAssignment, CanvasResponse } from "@/lib/day";
import { canvasList, clearCanvas, readCanvas, syncCanvas } from "@/lib/canvas-store";
import { formatTime } from "@/lib/tz";
import { browserZone, canvasHost, dueDays, httpsOnly } from "@/components/desk-rows";

const REFUSED: Partial<Record<CanvasResponse["state"], string>> = {
  "bad-url": "Use your school's Canvas address, like sjsu.instructure.com.",
  "bad-token": "Canvas didn't accept that token. Make a new one and paste it again.",
  "not-allowed": "Your school doesn't allow access tokens, so Zeno can't connect.",
};

const dueLabel = (due: string | null) =>
  due
    ? new Date(due).toLocaleString("en-US", { timeZone: browserZone(), weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "No due date";

// Stable, so focus moves only when the element first appears.
const focusOnMount = (el: HTMLElement | null) => el?.focus();

// Connect Canvas, opened from the account menu: the school's Canvas address and a personal access token, kept only on
// this device (src/lib/canvas-store.ts syncCanvas). The token is never shown again or logged.
// onSynced runs after Canvas accepted the link (and after a disconnect, with []), so the page can refresh the day.
export default function CanvasSheet({ account, onSynced }: { account: string; onSynced: (assignments: CanvasAssignment[]) => void }) {
  const [host, setHost] = useState(() => {
    const link = readCanvas(account);
    return link ? canvasHost(link.base) : null;
  });
  const [list, setList] = useState(() => canvasList(account)); // the last sync's unsubmitted work
  const [now] = useState(Date.now); // when the sheet opened, for Today and Tomorrow
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const [moved, setMoved] = useState(false); // connected or disconnected here, so focus follows the new view

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const link = { base: String(form.get("base") ?? "").trim(), token: String(form.get("token") ?? "").trim() };
    setBusy(true);
    setRefused("");
    const res = await syncCanvas(account, link);
    setBusy(false);
    if (res?.state !== "ok") return setRefused(REFUSED[res?.state ?? "error"] ?? "Couldn't reach Canvas. Try again.");
    setHost(canvasHost(link.base));
    setList(res.assignments.filter((item) => !item.submitted));
    setMoved(true);
    onSynced(res.assignments);
  }

  // Undone here at once; then, best effort, the Canvas deadlines Zeno saved are deleted too before the day is read again.
  async function disconnect() {
    clearCanvas(account);
    setHost(null);
    setMoved(true);
    await fetch("/api/canvas", { method: "DELETE" }).catch(() => null);
    onSynced([]);
  }

  if (!host)
    return (
      <form className="flex flex-col gap-4" onSubmit={connect}>
        <p className="text-ink-2">
          Bring your Canvas assignments into your plan. Zeno only reads them; it never submits or changes anything. Your token
          stays on this device.
        </p>
        <div className="mini flex flex-col gap-4">
          <label className="flex flex-col">
            <span className="font-bold">School Canvas address</span>
            <input
              ref={moved ? focusOnMount : undefined}
              name="base"
              required
              className="add"
              placeholder="sjsu.instructure.com"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
            />
          </label>
          <label className="flex flex-col">
            <span className="font-bold">Access token</span>
            {/* Text, not a password field, so Chrome and Safari never offer to save the token to a synced password manager. */}
            <input
              name="token"
              required
              className="add secret"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
            />
          </label>
          <p className="text-ink-2">In Canvas: Account → Settings → + New Access Token. Name it Zeno and paste it here.</p>
        </div>
        <button type="submit" aria-disabled={busy} className="pill pill-ink">
          {busy ? "Connecting…" : "Connect"}
        </button>
        <p role="status">{refused}</p>
      </form>
    );

  // A link kept before the list was (Nov 2) names only the school until the next sync.
  const zone = browserZone();
  const days = list && dueDays(list, zone, now);
  const count = days?.reduce((sum, day) => sum + day.items.length, 0) ?? 0;
  return (
    <>
      <p ref={moved ? focusOnMount : undefined} tabIndex={-1}>
        {days ? `Connected · ${count || "Nothing"} due in the next 2 weeks.` : `Connected to ${host}.`}
      </p>
      {days && count > 0 && (
        <div className="mini">
          <div className="lines">
            {days.map(({ day, items }) => (
              <Fragment key={day}>
                <h3 className="font-bold">{day}</h3>
                <ul>
                  {items.map((item) => {
                    const name = [item.course, item.title, dueLabel(item.due)].filter(Boolean).join(" · ");
                    return (
                      <li key={item.id}>
                        <a
                          href={httpsOnly(item.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={name}
                          aria-label={name}
                          className="group flex items-baseline gap-4"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {item.course && <span className="mr-2 text-ink-2">{item.course}</span>}
                            <span className="underline-offset-4 group-hover:underline">{item.title}</span>
                          </span>
                          {item.due && <span className="shrink-0 font-mono leading-none text-ink-2">{formatTime(item.due, zone)}</span>}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={disconnect} className="quiet-x self-start">
        Disconnect
      </button>
    </>
  );
}
