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
