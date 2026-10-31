# Zeno

Zeno makes starting the easy part. Sign in with Google and the first card is
there at once: Zeno says one short line about your day (from your calendar,
inbox, goals and what it remembers) and offers three things to tap. It shrinks
the one you pick into tiny steps and walks you through them one index card at a
time, by voice or by tapping. Built for the Meta Global AI Developer Hackathon
with Muse Spark (tool-calling agent, JSON replies with options) and Muse Voice
Transcribe (realtime speech input).

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
