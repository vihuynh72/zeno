"use client";

import { useEffect, useRef, useState } from "react";
import type { AppTokenResponse } from "@/lib/day";

// Connect an app, from the account menu (docs/PLAN-NOV3-APPS.md): a personal token for MCP clients (Muse Code, Claude
// Code) and the Zeno Mac clock. The sheet is day-view's SheetPanel, kept here so the menu needs nothing from the page.
export default function AppsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The heading takes focus, so Close only shows its ring once someone tabs to it.
      dialog.querySelector("h2")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Connect an app"
      className="sheet"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex min-h-full flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 tabIndex={-1} className="text-[28px] leading-10 font-bold">
            Connect an app
          </h2>
          <button type="button" onClick={onClose} className="pill pill-small">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close
          </button>
        </div>
        {/* Mounted only while open: closing the sheet forgets the token. */}
        {open && <Connect />}
      </div>
    </dialog>
  );
}

// The token lives only in this state: shown once, never stored in the browser or logged.
function Connect() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setNote("");
    const res = (await fetch("/api/app-token", { method, cache: "no-store" })
      .then((response) => response.json())
      .catch(() => null)) as AppTokenResponse | null;
    setBusy(false);
    return res;
  }

  async function make() {
    if (busy) return;
    const res = await send("POST");
    if (res?.state === "ok") setToken(res.token);
    else setNote(res?.state === "signed-out" ? "Sign in again to make a token." : "Couldn't make a token. Try again.");
  }

  async function turnOff() {
    if (busy) return;
    const res = await send("DELETE");
    if (res?.state !== "off") return setNote("Couldn't turn it off. Try again.");
    setToken(null);
    setNote("Turned off. No app can reach Zeno with it now.");
  }

  async function copy(text: string) {
    const copied = await navigator.clipboard?.writeText(text).then(
      () => true,
      () => false,
    );
    setNote(copied ? "Copied." : "Couldn't copy. Select it and copy it instead.");
  }

  const url = `${window.location.origin}/api/mcp`;
  const rows = token && [
    { label: "Token", text: token },
    { label: "MCP address", text: url },
    {
      label: "Muse Code, in settings.json",
      text: [
        `"mcp_servers": {`,
        `  "zeno": {`,
        `    "transport": "streamable_http",`,
        `    "url": "${url}",`,
        `    "headers": { "Authorization": "Bearer ${token}" }`,
        `  }`,
        `}`,
      ].join("\n"),
    },
    { label: "Claude Code", text: `claude mcp add --transport http zeno ${url} --header "Authorization: Bearer ${token}"` },
  ];

  return (
    <>
      <p className="text-ink-2">
        Lets Muse Code, Claude Code or the Zeno Mac clock see and update your goals and steps. Never your mail, your calendar or
        what Zeno remembers. Making a token turns off the one you made before.
      </p>
      {rows ? (
        <>
          <p>Copy it now: Zeno shows it once. A new token turns this one off.</p>
          <div className="mini flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold">{row.label}</h3>
                  <button type="button" onClick={() => copy(row.text)} aria-label={`Copy ${row.label}`} className="quiet-x">
                    Copy
                  </button>
                </div>
                <code className="block font-mono break-all whitespace-pre-wrap">{row.text}</code>
              </div>
            ))}
          </div>
        </>
      ) : (
        <button type="button" onClick={make} aria-disabled={busy} className="pill pill-ink">
          {busy ? "Making a token…" : "Make a token"}
        </button>
      )}
      <button type="button" onClick={turnOff} aria-disabled={busy} className="quiet-x self-start">
        Turn off
      </button>
      <p role="status">{note}</p>
    </>
  );
}
