# Zeno handoff

Last updated: 2026-10-29, evening PT, by Claude (Claude Code session with Vi).
Read this first, then the Linear doc **"Zeno hackathon build plan (Nov 4)"** (project Zeno, team VI).

## 1. What Zeno is, and the deadline

Zeno is a voice-first daily helper: it gives a short spoken brief from your calendar, inbox and goals, helps you pick one thing, shrinks it to a tiny first step (or a short roadmap), and walks you through it on one card at a time.

- Hackathon: **Meta Global AI Developer Hackathon** (Meta + Cerebral Valley). Track: **Indie Developer**. Problem statement: **Build for Your World**.
- Deadline: **2026-11-04 6:00 PM PT** (9 PM ET). The portal takes 6 h late but marks it late; never change the repo field after the deadline. Live finals Nov 9 (Vi demos live).
- Judging: Impact 30%, Use of Meta AI tooling 25% ("beyond a basic integration"), Technical depth 20%, Demo 25% (live robustness + video).
- Submission form (Cerebral Valley, logged in): team name, track, problem statement, optional X post link, description, public GitHub repo, **3-minute demo video**, "use of Meta products", "why Meta's models matter", partner feedback, two survey questions. No live-URL field.
- Muse rules that bind the code: about $90 of the $150 credit left (no hard spend cap, alerts only); never send personal data to `*-contributor` models; never present Zeno as human; confirm before consequential actions (email send, calendar write). Event materials are not confidential, so the video uses the demo Google account **dotcainha@gmail.com**.

## 2. Links

- Production: https://zeno-sigma-topaz.vercel.app (the only public alias; other Vercel URLs hit SSO). `main` auto-deploys.
- Repo: https://github.com/vihuynh72/zeno (public). Vercel project `zeno` (prj_D3rIVKCrUeVOknOO6Uq9LH7jyXtS, team_gH5DTHjhSFPp1cwCWaSZqo6L, Hobby, Fluid on, iad1).
- Linear (project Zeno): Master Plan, context docs C01-C12, **C10 decisions D21-D29** (today's decisions), **C07 credential register** (current), and the build plan doc above.
- Google Cloud project for OAuth: 783701621971 (owned by Vi's Google account).

## 3. Decisions Vi made (2026-10-29)

- Layout **"Guided day"**: one step per screen (brief, pick one thing, first step or roadmap, focus, check-in). Calendar and email appear inside what Zeno says, not as panels.
- Persona **warm, candid friend**: short, offers instead of orders, one question at a time, honest when a plan will not fit. ("Sounds like a dictator" meant both the bossy prompt and the dictation-style voice flow.)
- Voice: Google Chirp 3 HD **Achernar**, speakingRate 1.
- Extras, all wanted, in build order: Meta voice input (done, see 4), roadmap editable by voice, memory per account ("what Zeno remembers", with delete; no embeddings since Meta has no embedding model), remembers yesterday, **calendar block** (write the first step to Google Calendar after confirmation), **prep pack** (sources for the first step; first to cut if late).
- Visual world: **Index Card** (white ruled study card, blue rules, red margin line, the roadmap as a stack beneath, Atkinson Hyperlegible Next and Mono) fused with the **On Air dot ring** as the voice indicator around the Talk button. Light and dark follow the system. Vi: "simple, human, very ADHD friendly, not overwhelming". The card world must later grow into a workstation (calendar, inbox, AI as cards) without cluttering the guided flow.
- Process: Claude merges to `main` itself after checks; Claude may change anything in the Linear Zeno project; ask Vi before big product choices.

## 4. What is live on main / production

| Commit | What |
|---|---|
| ff2f9a8 | Google token refresh (Reconnect Google when it fails), user time zone via `tz` cookie (`src/lib/tz.ts`), current time in the model context, honest source labels, Muse calls with `reasoning_effort` (chat minimal, brief low + strict JSON schema), chat history, parallel context loading with a 2-min Google cache, friendly auth error landing, Google token kept out of `/api/auth/session`, Achernar voice |
| 02d69b0 | `src/lib/day.ts`: the API contract between the new screens and routes |
| de74604 | Meta realtime speech-to-text: `/api/listen` WebSocket relay (`upgradeWebSocket` from `@vercel/functions`) to `muse-voice-transcribe-1.0`, browser adapter `listenMeta()` in `src/lib/listen-meta.ts` |

Verified on production: time zone and honest brief; `/api/auth/session` has no access token; voice relay end to end (final transcript 0.58 s after speech ends, 10 live partials). The **old UI** (brief, calendar, email, goals, talk cards) is still what users see.

## 5. In flight: three open PRs (links in section 9)

Three parallel tracks were built and adversarially reviewed by sub-agents in git worktrees under `.claude/worktrees/` on this Mac:

- `feat/agent-core`: tables `goals`, `steps`, `memories`; `src/lib/goals.ts`; `src/lib/agent.ts` (warm-friend prompt `ZENO_VOICE_PROMPT`, Muse tool loop: set_goal, update_steps, start_step, finish_step, remember, forget, with short refs s1/m1 instead of UUIDs); routes `GET /api/day`, `POST /api/talk`, `PATCH /api/steps/[id]`, `GET/DELETE /api/memory`.
- `feat/voice-core`: `src/lib/use-voice.ts` (hands-free half-duplex loop: listening, thinking, speaking, listening), `src/lib/listen.ts` (`listenWeb`, Web Speech adapter with mic level), sentence-pipelined TTS in `src/lib/speak.ts`, `/api/speak` returning MP3 bytes.
- `feat/guided-day-ui`: the Index Card screens, dot ring, Today and Memory sheets, `/preview` state gallery (dev only), deletes the old UI components and old routes. Ships a **stub** `src/lib/use-voice.ts`.

### Merge order (next session's first job)
1. Merge `feat/agent-core`, then `feat/voice-core` (both leave the old UI working).
2. Merge `feat/guided-day-ui` last. Conflict on `src/lib/use-voice.ts`: **keep voice-core's real file**, drop the UI stub.
3. Wire Meta voice input: `useVoice(options, { listen })` accepts an adapter; `listenMeta` (src/lib/listen-meta.ts) and `listenWeb` share the same `ListenHandlers` shape. Use `listenMeta` in Chrome and fall back to `listenWeb` on `network` / `unsupported`. Pass `levelRef` so the ring moves. Stop (not pause) the Meta session whenever Zeno is idle or in focus mode: an open session streams about 32 KB/s and Vercel Hobby's 10 GB transfer quota pauses the whole project for 30 days if exceeded. `listenMeta` already auto-stops after 2 min without speech or when the tab is hidden.
4. Run all checks (section 7), deploy, test on production with Vi's account: typed turns end to end (set a goal, edit the roadmap, start, finish, remember), then ask Vi to test voice in Chrome.
5. Impeccable finish: spawn the `impeccable-finish-reviewer` with screenshots and the direction contract, fix, then `impeccable-documenter` to write DESIGN.md (`.impeccable/surfaces/src-app-page-tsx.md` holds the contract, seed a8b9951e90f4c9e5).

## 6. Remaining work after that (priority order)

1. Calendar block: add `https://www.googleapis.com/auth/calendar.events` to the Google scope in `src/auth.ts` (everyone re-consents once), a `schedule_step` tool that only proposes, and a confirm button before writing (Meta AUP).
2. Prep pack: Muse Responses API with the built-in `web_search` tool ($2.50 per 1k queries) for 2-3 sources on the first step. Cut first if late.
3. Demo data in dotcainha@gmail.com (calendar week, a few emails), then record the 3-minute video (storyboard idea: problem, Start my day, spoken brief, talk about an avoided task, tiny first step and roadmap edited by voice, focus card, "done" stamp, under-the-hood slide on Muse Spark tools + Muse Voice Transcribe).
4. Submission text: description, "use of Meta products" (Muse Spark with per-surface reasoning effort, tool calling that edits goals, roadmap and memory, strict JSON schema; Muse Voice Transcribe realtime with endpointing and keyword biasing through a Vercel WebSocket relay), "why Meta's models matter".
5. README: local voice needs `npx vercel@65.7.0 dev --local`.
6. Deferred past Nov 4 (record as unmet in Linear, per C09): journal, undo, drag planner, travel-aware conflicts, overfull-day tradeoffs, durable background work, email drafts and sending, Productive News, scheduled reflection, MCP, team mode, native apps.

## 7. How to work in this repo

- Fresh checkout: `npm ci`, then `npx next typegen` (otherwise tsc fails on `LayoutProps`).
- Checks before any merge: `npx tsc --noEmit --incremental false`, `npx eslint src/`, `npx next build`, `TZ=UTC node src/lib/tz.check.ts`, `node src/lib/session-json.check.ts`, `node --no-warnings scripts/listen-check.mjs`, plus any new `*.check.ts`.
- Next 16 with `cacheComponents: true`: never export `runtime`, `dynamic`, `revalidate`, `fetchCache` or `dynamicParams` from a route; `maxDuration` is fine.
- Voice locally: `npx vercel@65.7.0 dev --local` (plain `next dev` cannot upgrade WebSockets, so `/api/listen` fails there).
- Env var names (values in `.env.local` and Vercel, never in git): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `META_MODEL_API_KEY`, `GOOGLE_TTS_API_KEY`, `DATABASE_URL`.
- Muse facts (tested): `muse-spark-1.3` always reasons; `reasoning_effort: "minimal"` gives a first token in about 1-2 s on Zeno prompts (default effort took about 10 s); tool calls arrive with a spoken-sounding preamble ("Got it, I'll add that"): never speak it as the result; `tool_choice` only supports `"auto"`; Meta has no TTS.
- The server runs in UTC: use `src/lib/tz.ts` for anything about "today" or clock times.

## 8. Open items for Vi

- Click **Reconnect Google** on Zeno once (sessions from before the token fix have no refresh token).
- Google OAuth audience: Vi said the app is "not testing or in production"; confirm in Google Auth Platform > Audience, and if it is in Testing, add dotcainha@gmail.com as a test user. Testing-mode refresh tokens expire after 7 days, so sign in again before the Nov 9 finals.
- Rotate the Meta and Google keys after Nov 4 (they were pasted into a chat once); restrict the Google key to the Text-to-Speech API.
- Local-only files (gitignored or untracked on purpose): `PRODUCT.md`, `.impeccable/` (design contract, decision sketches, detector config), `zeno-onboarding.html`.

## 9. Pull requests (open, not merged)

All three passed tsc, eslint, next build and their self-checks after an adversarial review and fix pass. Merge in this order (section 5):

1. https://github.com/vihuynh72/zeno/pull/1 `feat/agent-core`: goals, roadmap, memory, warm-friend agent with Muse tool calls. Live-measured: `minimal` effort gives concrete roadmaps with 5-10 min first steps; a turn with one tool call takes about 4-7 s.
2. https://github.com/vihuynh72/zeno/pull/2 `feat/voice-core`: hands-free voice loop, sentence-pipelined speech, `listenWeb`.
3. https://github.com/vihuynh72/zeno/pull/3 `feat/guided-day-ui`: the Index Card screens. Keep PR 2's `src/lib/use-voice.ts` over this PR's stub.

Their worktrees (with node_modules installed) are still on this Mac: `.claude/worktrees/wf_5329a5e3-138-1` (PR 1), `-2` (PR 2), `-3` (PR 3). A `/preview?state=<name>&theme=<light|dark>` gallery shows every screen in `next dev`.

Known small issues left (low severity, from the reviews):
- PR 2: the phase becomes `speaking` slightly before audio starts, so words can lead the voice; without Web Audio, `start()` throws instead of falling back to the browser voice.
- PR 3: Memory "Forget" loses focus; roadmap titles truncate on phones; a failed turn drops the typed text; "Start my day" after "Not now" replays the opening from page load; Sign out only lives in the Memory sheet.
- PR 1: the AI opening may say "Good evening" a little before 6 PM (model's call); the 25 s abort path was never triggered live.

Privacy note: one headless voice test used this Mac's real microphone, so about 10 s of ambient audio went to Chrome's speech service; the local log was deleted. Snippets may remain in that sub-agent's local Claude transcript.
