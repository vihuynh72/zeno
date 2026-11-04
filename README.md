# Zeno

Zeno makes starting the easy part. Sign in with Google and the first card is
there at once: Zeno says one short line about your day (from your calendar,
inbox, goals and what it remembers) and offers three things to tap. It shrinks
the one you pick into tiny steps and walks you through them one index card at a
time, by voice or by tapping. Built for the Meta Global AI Developer Hackathon
with Muse Spark (tool-calling agent, JSON replies with options) and Muse Voice
Transcribe (realtime speech input).

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
