"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { APP_NAMES, atlassianSite, type App } from "@/lib/connect";
import type { ConnectStatus } from "@/lib/connect-config";
import { clearToken, readApp, readToken, saveToken } from "@/lib/connect-store";
import { Icon } from "@/components/icons";

// Apps (Vi, Nov 4: "there's no connector for other apps yet"): what each app brings in a few words, and Connect or
// Disconnect.
// Tokens stay on this device (src/lib/connect-store.ts). Opened from the header's Apps and from "Connect your apps"
// under + Add goal. Jira and Confluence share one Atlassian sign-in: connecting or disconnecting one does both.

// 3-5 words each (Vi, Nov 4: "don't overwhelm with words"); what they bring becomes goals.
const BRINGS: Record<App, string> = {
  notion: "Your pages and tasks",
  gdocs: "Docs shared by link",
  slack: "Messages that ask you",
  linear: "Issues assigned to you",
  trello: "Cards you're on",
  jira: "Issues assigned to you",
  confluence: "Tasks assigned to you",
};
const ORDER: App[] = ["notion", "gdocs", "slack", "linear", "trello", "jira", "confluence"];
const PASTED: App[] = ["linear", "jira", "confluence"]; // a key pasted here: nothing to set up on the server
const LINEAR_KEYS = "https://linear.app/settings/account/security";
const ATLASSIAN_TOKENS = "https://id.atlassian.com/manage-profile/security/api-tokens";
// Trello's authorize page hands back a read token (#token=…) at /connect/trello; Notion and Slack sign in through
// /api/connect/<app>/start (the Notion/Slack track), which ends at /connect/<app> too.
const startUrl = (app: App) =>
  app === "trello"
    ? `https://trello.com/1/authorize?${new URLSearchParams({
        expiration: "30days",
        name: "Zeno",
        scope: "read",
        response_type: "token",
        key: process.env.NEXT_PUBLIC_TRELLO_KEY ?? "",
        return_url: `${window.location.origin}/connect/trello`,
      })}`
    : `/api/connect/${app}/start`;

type Props = {
  account: string | null; // whose tokens, once the page knows
  google: { mail: boolean; calendar: boolean };
  canvas: boolean;
  connected?: App | null; // just back from an app's sign-in
  onGoogle(): void;
  onCanvas(): void;
  onChange(): void; // a token kept or dropped: the page reads the apps again
};

export default function YourApps({ account, google, canvas, connected, onGoogle, onCanvas, onChange }: Props) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [tokens, setTokens] = useState(() => new Set(ORDER.filter((app) => account && readToken(app, account))));
  const [pasting, setPasting] = useState<App | null>(null); // the row whose key form is open
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(connected ? `Connected ${APP_NAMES[connected]}.` : "");
  useEffect(() => {
    void fetch("/api/connect/status")
      .then((response) => response.json() as Promise<ConnectStatus>)
      .then(setStatus, () => setStatus(null));
  }, []);

  // From this device's storage, so Jira and Confluence (one key) change together.
  const reread = () => setTokens(new Set(ORDER.filter((app) => account && readToken(app, account))));
  const named = (app: App) => (app === "jira" || app === "confluence" ? "Jira and Confluence" : APP_NAMES[app]);

  // Linear takes its key; Jira and Confluence take her site, email and API token as one JSON value.
  async function paste(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    if (busy || !account || !pasting || !field("token")) return;
    const linear = pasting === "linear";
    const site = linear ? null : atlassianSite(field("site"));
    if (!linear && !site) return setNote("Use your site's address, like your-team.atlassian.net.");
    const token = linear ? field("token") : JSON.stringify({ site, email: field("email"), token: field("token") });
    setBusy(true);
    setNote("");
    const res = await readApp(pasting, token);
    setBusy(false);
    if (res.state !== "ok") {
      if (linear) return setNote(res.state === "no-access" ? "Linear didn't accept that key." : "Couldn't reach Linear. Try again.");
      return setNote(res.state === "no-access" ? "Check your email and token." : "Couldn't reach that site. Check the address.");
    }
    saveToken(pasting, account, token);
    reread();
    setPasting(null);
    const noun = pasting === "confluence" ? "task" : "issue";
    setNote(`Connected ${named(pasting)} · ${res.items.length || "No"} open ${res.items.length === 1 ? noun : `${noun}s`}.`);
    onChange();
  }

  function disconnect(app: App) {
    if (!account) return;
    clearToken(app, account);
    reread();
    setNote(`Disconnected ${named(app)}.`);
    onChange();
  }

  const action = (app: App) => {
    if (app === "gdocs") return <span className="text-ink-2">Paste a link</span>;
    if (tokens.has(app))
      return (
        <button type="button" onClick={() => disconnect(app)} className="quiet-x">
          Disconnect
        </button>
      );
    if (!PASTED.includes(app) && !status?.[app]) return <span className="text-ink-2">Soon</span>;
    return (
      <button
        type="button"
        aria-disabled={!account}
        onClick={() => (!account ? undefined : PASTED.includes(app) ? setPasting(app) : window.location.assign(startUrl(app)))}
        className="pill pill-small"
      >
        Connect
      </button>
    );
  };

  const rows: { name: string; brings: string; action: ReactNode; app?: App }[] = [
    { name: "Gmail", brings: "Mail that asks you", action: google.mail ? <span className="text-ink-2">Connected</span> : <ConnectGoogle onClick={onGoogle} /> },
    { name: "Google Calendar", brings: "Free time for your steps", action: google.calendar ? <span className="text-ink-2">Connected</span> : <ConnectGoogle onClick={onGoogle} /> },
    {
      name: "Canvas",
      brings: "Assignments and due dates",
      action: (
        <button type="button" onClick={onCanvas} className={canvas ? "quiet-x" : "pill pill-small"}>
          {canvas ? "Open" : "Connect"}
        </button>
      ),
    },
    ...ORDER.map((app) => ({ name: APP_NAMES[app], brings: BRINGS[app], action: action(app), app })),
  ];

  return (
    <>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.name} className="border-b-2 border-track py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold">
                  {row.name}
                  {row.app && tokens.has(row.app) && <span className="font-normal text-ink-2"> · connected</span>}
                </h3>
                <p className="text-ink-2">{row.brings}</p>
              </div>
              <div className="shrink-0">{row.action}</div>
            </div>
            {row.app && row.app === pasting && (
              <form className="mini mt-3 flex flex-col gap-3" onSubmit={paste}>
                {pasting !== "linear" && (
                  <>
                    <label className="flex flex-col">
                      <span className="font-bold">Site</span>
                      <input
                        name="site"
                        required
                        autoFocus
                        placeholder="your-team.atlassian.net"
                        className="add"
                        inputMode="url"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="font-bold">Email</span>
                      <input name="email" type="email" required className="add" autoComplete="email" />
                    </label>
                  </>
                )}
                <label className="flex flex-col">
                  <span className="font-bold">{pasting === "linear" ? "API key" : "API token"}</span>
                  {/* Text, not a password field, so the browser never offers to save the key to a synced password manager. */}
                  <input
                    name="token"
                    required
                    autoFocus={pasting === "linear"}
                    className="add secret"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                  />
                </label>
                {/* Where to make one, and the privacy fact: kept on this device only. */}
                <p className="flex flex-wrap items-center gap-x-4 text-ink-2">
                  <a href={pasting === "linear" ? LINEAR_KEYS : ATLASSIAN_TOKENS} target="_blank" rel="noopener noreferrer" className="link -ml-1 gap-1.5">
                    {pasting === "linear" ? "Get a key" : "Get a token"}
                    <Icon name="external" className="h-[18px] w-[18px]" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <span>{pasting === "linear" ? "Stays on this device." : "One for Jira and Confluence. Stays on this device."}</span>
                </p>
                <button type="submit" aria-disabled={busy} className="pill pill-ink">
                  {busy ? "Connecting…" : `Connect ${APP_NAMES[pasting]}`}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="empty:hidden">
        {note}
      </p>
      <McpBlock />
    </>
  );
}

const ConnectGoogle = ({ onClick }: { onClick(): void }) => (
  <button type="button" onClick={onClick} className="pill pill-small">
    Connect
  </button>
);

// Zeno inside Claude or ChatGPT: a custom connector with this address, then Zeno's own sign-in (src/lib/oauth.ts).
function McpBlock() {
  const [copied, setCopied] = useState("");
  const url = `${window.location.origin}/api/mcp`;
  return (
    <section className="mini mt-2">
      <h3 className="font-bold">Claude or ChatGPT</h3>
      <p>Add Zeno as a custom connector:</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <code className="min-w-0 font-mono break-all">{url}</code>
        <button
          type="button"
          aria-label="Copy address"
          title="Copy"
          className="icon-btn"
          onClick={() =>
            void navigator.clipboard?.writeText(url).then(
              () => setCopied("Copied."),
              () => setCopied("Couldn't copy. Select it and copy it instead."),
            )
          }
        >
          <Icon name="copy" />
        </button>
      </div>
      <p className="text-ink-2">Goals and steps only. Never mail, calendar or memory.</p>
      <p role="status" className="text-ink-2 empty:hidden">
        {copied}
      </p>
    </section>
  );
}
