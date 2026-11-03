"use client";

import { type FormEvent, useState } from "react";
import type { CanvasAssignment, CanvasResponse } from "@/lib/day";
import { canvasBriefs, clearCanvas, readCanvas, syncCanvas } from "@/lib/canvas-store";
import { browserZone, canvasHost } from "@/components/desk-rows";

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
  const [synced, setSynced] = useState<CanvasAssignment[] | null>(null); // this sheet's own sync
  const [briefs] = useState(() => canvasBriefs(account)); // the last sync's soonest work, kept on this device
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
    setSynced(res.assignments);
    setMoved(true);
    onSynced(res.assignments);
  }

  function disconnect() {
    clearCanvas(account);
    setHost(null);
    setSynced(null);
    setMoved(true);
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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

  // Just connected: what this sync found. Opened later: the soonest work the last sync kept on this device.
  const due = synced?.filter((item) => !item.submitted);
  const rows = (due ?? briefs).slice(0, 5);
  return (
    <>
      <p ref={moved ? focusOnMount : undefined} tabIndex={-1}>
        {!due
          ? `Connected to ${host}.`
          : due.length === 0
            ? "Connected. Nothing due in the next 2 weeks."
            : `Connected. ${due.length} ${due.length === 1 ? "assignment" : "assignments"} due in the next 2 weeks.`}
      </p>
      {rows.length > 0 && (
        <div className="mini">
          <ul className="lines">
            {rows.map((row, i) => (
              <li key={`${i}:${row.course}:${row.title}`}>
                <span className="text-ink-2">{row.course} · </span>
                {row.title}
                <span className="text-ink-2"> · {dueLabel(row.due)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={disconnect} className="quiet-x self-start">
        Disconnect
      </button>
    </>
  );
}
