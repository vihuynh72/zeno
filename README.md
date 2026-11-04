# Zeno

Zeno makes starting the easy part. Sign in with Google and the first card is
there at once: Zeno says one short line about your day (from your calendar,
inbox, goals and what it remembers) and offers three things to tap. It shrinks
the one you pick into tiny steps and walks you through them one index card at a
time, by voice or by tapping. Built for the Meta Global AI Developer Hackathon
with Muse Spark (tool-calling agent, JSON replies with options) and Muse Voice
Transcribe (realtime speech input).

## Try Zeno

Open https://zeno-sigma-topaz.vercel.app in Chrome, Edge or Safari.

1. Tap **Sign in with Google**.
2. Zeno is a new hackathon app, so Google says it isn't verified yet. Choose
   **Advanced**, then **Go to Zeno**.
3. Google lists what Zeno asks for. Tick each box (or **Select all**), then
   **Continue**.
4. Zeno reads your calendar and email once, in about 15 seconds, and says what
   it learned. Tap **Start my day**, then pick what you're working on.

What Zeno asks for, and why:

- **Your name and email**, to know whose day it is.
- **Your calendars, read only**, to plan around your real day and find free
  time.
- **A calendar of its own**: Zeno makes a Zeno calendar and adds a block there
  only when you book one. It never changes your other calendars.
- **Gmail, read only**, to learn what matters to you and show the email that
  asks you something. Zeno never sends, deletes or changes mail.

Privacy, in short: Zeno keeps your goals, your steps and short facts it
remembers, and you can see and delete every fact in Memory. Its servers never
save your emails or calendar events. Private things, like health or money, are
kept only in your browser, never on Zeno's servers. Meta's Muse models write
Zeno's replies. Zeno never sells your data, shows ads or trains AI on it. The
full policy: https://zeno-sigma-topaz.vercel.app/privacy

### Install it

Zeno can open in its own window, with its own icon:

- **Chrome or Edge:** Install Zeno, in the address bar or the browser's menu.
- **Safari on a Mac:** File → Add to Dock.
- **iPhone:** sign in in Safari first, then Share → Add to Home Screen.

**Add from a photo:** under your goals, snap an assignment handout and Zeno makes its plan. Meta's Muse model reads
the photo once; Zeno never keeps it.

## Zeno Clock (Mac menu bar)

Zeno Clock keeps your running step in the Mac menu bar, counting up while you work ("12:31 · Outline the intro…"). Its menu shows the step and its goal ("2 of 5 done"), Done, Open Zeno, Set token… and Quit. It checks Zeno every 10 seconds and whenever you open the menu. It needs macOS 14 or later.

Build and open it. You need Xcode or the Command Line Tools (`xcode-select --install`).

```bash
mac/make-app.sh
open "mac/Zeno Clock.app"
```

For a quick try without the app bundle: `swift run --package-path mac`.

**Connect it.** Zeno Clock never asks you to sign in with Google. It uses a token instead. In Zeno, open the account menu, choose Connect an app, then Make a token, and copy it. Then click Zeno in the menu bar, choose Set token…, paste the token and press Save. The token stays in your Mac's Keychain. Zeno shows a token only once, and a new token turns the old one off, so paste a new one into every app you connected.

**Opening a copy built on another Mac.** Zeno Clock is ad-hoc signed but not notarized (there is no paid Apple developer account), so macOS says it can't check the app. On macOS 14, right-click the app, choose Open, then choose Open again. On macOS 15 and later, try to open it once, then go to System Settings → Privacy & Security and choose Open Anyway. An app you build yourself with `make-app.sh` opens without this prompt.

**Try it without an account.**

```bash
python3 mac/mock-companion.py      # a fake Zeno on port 8790 with made-up steps
ZENO_URL=http://127.0.0.1:8790 swift run --package-path mac
```

Set the token to `zeno_mock_token_for_local_tests`. `swift test --package-path mac` runs the checks. With a freshly started mock running, `ZENO_MOCK=http://127.0.0.1:8790 swift test --package-path mac` also runs the real calls. After a rebuild, macOS may ask once to let Zeno Clock use its Keychain item; choose Always Allow.

## Connect an AI app

Zeno is also an MCP server, so an AI app can see and update your goals and steps. It never sees your mail, your
calendar or what Zeno remembers. In Zeno, open the account menu, choose **Connect an app**, then **Make a token**.
Zeno shows the token once. Making a new one turns the old one off, and **Turn off** stops it.

**Muse Code:** add Zeno to the `mcp_servers` block of `~/.config/muse/settings.json`:

```json
"mcp_servers": {
  "zeno": {
    "transport": "streamable_http",
    "url": "https://zeno-sigma-topaz.vercel.app/api/mcp",
    "headers": { "Authorization": "Bearer <token>" }
  }
}
```

**Claude Code:**

```bash
claude mcp add --transport http zeno https://zeno-sigma-topaz.vercel.app/api/mcp --header "Authorization: Bearer <token>"
```

The tools are `list_goals`, `next_step`, `plan_goal` (a title and an optional due date, at most 20 new plans a day),
`start_step` and `finish_step`. The Zeno Mac clock uses the same token with `GET /api/companion/now` and
`POST /api/companion/done`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` and fill in the
values. Never commit `.env.local`.

Voice input goes through a WebSocket route (`/api/listen`) that only runs on
Vercel's runtime. To try it locally, run `npx vercel@65.7.0 dev --local`
instead of `npm run dev`; with plain `next dev`, Zeno falls back to the
browser's speech recognition.

## Checks

```bash
npx next typegen
npx tsc --noEmit --incremental false
npx eslint src/
npx next build
for f in src/components/*.check.ts src/lib/*.check.ts; do node "$f"; done
node scripts/listen-check.mjs
```

Run `TZ=UTC node src/lib/tz.check.ts` to check time zones the way Vercel runs them.

## Deploy

The app deploys on Vercel from `main`. Set the environment variables from
`.env.example` in the Vercel project. See `HANDOFF.md` for the current state and
`docs/SUBMISSION.md` for the hackathon submission kit.
