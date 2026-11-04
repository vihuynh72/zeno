"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { APP_NAMES, atlassianSite, type App } from "@/lib/connect";
import type { ConnectStatus } from "@/lib/connect-config";
import { clearToken, readApp, readToken, saveToken } from "@/lib/connect-store";

// Your apps (Vi, Nov 4: "there's no connector for other apps yet"): what each app brings, and Connect or Disconnect.
// Tokens stay on this device (src/lib/connect-store.ts). Opened from the header's Apps and from "Connect your apps"
// under + Add goal. Jira and Confluence share one Atlassian sign-in: connecting or disconnecting one does both.

const BRINGS: Record<App, string> = {
  notion: "Pages and tasks assigned to you become goals.",
  gdocs: "Paste a doc's link in + Add goal. Share it as 'Anyone with the link' first.",
  slack: "Messages that ask you something become goals.",
  linear: "Issues assigned to you become goals.",
  trello: "Cards you're on become goals.",
  jira: "Issues assigned to you become goals.",
  confluence: "Tasks assigned to you become goals.",
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
    if (!linear && !site) return setNote("Use your Atlassian site's address, like your-team.atlassian.net.");
    const token = linear ? field("token") : JSON.stringify({ site, email: field("email"), token: field("token") });
    setBusy(true);
    setNote("");
    const res = await readApp(pasting, token);
    setBusy(false);
    if (res.state !== "ok") {
      if (linear) return setNote(res.state === "no-access" ? "Linear didn't accept that key. Make a new one and paste it again." : "Couldn't reach Linear. Try again.");
      return setNote(res.state === "no-access" ? "Atlassian didn't accept that. Check your email and API token." : "Couldn't reach that site. Check the address and try again.");
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
    if (app === "gdocs") return <span className="text-ink-2">By link</span>;
    if (tokens.has(app))
      return (
        <button type="button" onClick={() => disconnect(app)} className="quiet-x">
          Disconnect
        </button>
      );
    if (!PASTED.includes(app) && !status?.[app]) return <span className="text-ink-2">Not set up yet</span>;
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
    { name: "Gmail", brings: "Mail that asks you something becomes a suggestion.", action: google.mail ? <span className="text-ink-2">Connected</span> : <ConnectGoogle onClick={onGoogle} /> },
    { name: "Google Calendar", brings: "Free time for your steps, and steps on your calendar.", action: google.calendar ? <span className="text-ink-2">Connected</span> : <ConnectGoogle onClick={onGoogle} /> },
    {
      name: "Canvas",
      brings: "Assignments and their due dates become goals.",
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
                  <span className="font-bold">{pasting === "linear" ? "Personal API key" : "API token"}</span>
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
                {pasting === "linear" ? (
                  <p className="text-ink-2">
                    In Linear: Settings → Security &amp; access → New API key. It stays on this device.{" "}
                    <a href={LINEAR_KEYS} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      Open Linear&apos;s API keys<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                ) : (
                  <p className="text-ink-2">
                    One token connects Jira and Confluence. It stays on this device.{" "}
                    <a href={ATLASSIAN_TOKENS} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      Make an API token<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                )}
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
      <h3 className="font-bold">Use Zeno in Claude or ChatGPT</h3>
      <p>Add a custom connector with this address, then sign in and tap Allow.</p>
      <p className="text-ink-2">It can see your goals and steps, add goals and mark steps done. Never your mail, your calendar or what Zeno remembers.</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <code className="min-w-0 font-mono break-all">{url}</code>
        <button
          type="button"
          className="quiet-x shrink-0"
          onClick={() =>
            void navigator.clipboard?.writeText(url).then(
              () => setCopied("Copied."),
              () => setCopied("Couldn't copy. Select it and copy it instead."),
            )
          }
        >
          Copy
        </button>
      </div>
      <p role="status" className="text-ink-2 empty:hidden">
        {copied}
      </p>
    </section>
  );
}
