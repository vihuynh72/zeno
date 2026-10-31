# Zeno handoff

Last updated: 2026-10-31, 3:30 AM PT, by Claude (session 2, autonomous while Vi slept).
Read this first, then the Linear doc **"Zeno hackathon build plan (Nov 4)"** (project Zeno, team VI).

## 0. Session 2 (2026-10-31, 1:21-4:21 AM PT, autonomous while Vi slept)

### What Vi asked for (after testing the app)
Almost instant first moment; Zeno talks by default; "good morning" at 1 AM was wrong; it is slow; typing feels wrong ("people like to consume, not create"), so give options to tap; short and fast-paced "like a reel"; habit-forming ("addictive") so people commit; a smarter AI with real context; a first-run setup where people onboard themselves and Zeno stores that context well; calendar and email in the middle of the page (a mail feature is coming); pressing a button for long "feels weird". Vi asked to be challenged where wrong.

### Where I push back
- "Addictive": build an honest habit loop (instant start, one tap to begin, a satisfying DONE stamp, a streak of days with a finished step), not infinite feeds or guilt. It fits judging (Impact) and Vi's own "not overwhelming" rule.
- "Instant": the model cannot answer in 200 ms, so the first card renders from the browser cache and the model's words swap in when ready. That is the standard way to make it feel instant.
- Sound "on by default": browsers block audio until the person taps once on a site they rarely visit; Zeno tries to speak and falls back to a "Hear Zeno" button, never an error.
- "Import contacts": read as importing context (pasted notes, syllabus, to-dos). Google Contacts would need another OAuth scope and adds little before Nov 4. Confirm with Vi.

### Feature map (Linear VI-306 to VI-318)
1. Instant wake-up (VI-306), 2. tap-first choices (VI-307), 3. Zeno talks by default (VI-308), 4. 60-second first-run setup (VI-309), 5. import notes into memory (VI-310), 6. desk: calendar + inbox in the middle (VI-311, the workstation seed), 7. faster talk turns (VI-312), 8. daily streak + done pile (VI-313), 9. mail actions on the desk (VI-314), 10. calendar block (VI-315), 11. prep pack (VI-316), 12. demo video + submission (VI-317, due Nov 4), 13. context retrieval upgrade (VI-318).

### Context design (how Zeno knows the person)
- Sources, in prompt order: persona and what Zeno remembers (stable, so prompt caching can help), then today's calendar and inbox (live, cached 2 min per user), then the current goal and steps (Neon), then the last 12 turns (kept in the browser, never stored), then the new message.
- Durable context lives in Neon `memories` (at most 50 per user, 200 chars each, visible in the Memory sheet, deletable). It is filled by: the first-run setup cards, the `remember` tool during talk, and pasted notes (`POST /api/import` extracts up to 8 facts). No embeddings: Meta offers no embedding model and 50 short facts fit in about 1-2k tokens. When memory or notes outgrow the prompt, add Postgres full-text search and send only the top matches (VI-318).
- Never stored: audio, raw pasted notes (only the extracted facts), chat transcripts. Never sent to `*-contributor` models.

### Speed findings (production, 2026-10-31 1:27 AM)
- First screen waited 4.3 s: page TTFB 114 ms and first paint 0.6 s were fine; `/api/day` took 4.3 s because it waited on the model opening (3.1-3.4 s at reasoning_effort low, about 800 reasoning tokens) behind Calendar, Gmail and Neon.
- A talk turn without a tool call: 2.3 s (model 1.5 s at minimal, prompt about 2,200 tokens); with a tool call about 4-7 s (two model rounds).


### Results (all live on main = production, commit f83989b)
- **Voice works again.** The PR #3 merge had kept the text-only `use-voice` stub, so Zeno never spoke or listened. Restored the real hook (d8b95a2) and added `listenAuto` (`src/lib/listen.ts`): Muse Voice Transcribe through `/api/listen` first, Web Speech after the relay fails once.
- **"Still up?" before 5 AM** on both client (`day-flow.ts`) and server (`brief.ts`); the model opening is time-aware (late night offers winding down or setting up tomorrow).
- **Instant first card.** `GET /api/day` never calls the model (82-140 ms warm locally, 1.2 s cold on production with Google); the model opening and its options come from the new `GET /api/day/opening` (reasoning_effort minimal, 2-4 s) and swap in. The browser caches the last day, so a returning visit paints in 0.04-0.2 s (measured 84 ms locally, 220 ms first paint on production).
- **Tap-first.** The opening comes with up to 3 options; every Zeno question comes with quick replies (strict JSON `{say, options}` together with tools: 10 of 10 live turns valid); "Something else" opens talking. Typing has a visible Send button.
- **First-run setup** (5 one-tap cards, shown when a person has no memories and no goals) saves each answer as a memory; "paste notes" runs `POST /api/import` (Muse extracts up to 8 durable facts, never health or money). The opening after setup waits for those saves, so it can mention them.
- **Desk:** Today now unfolds in the middle of the page: goal strip, calendar timeline, inbox (personal mail first; bulk mail is marked). Seed of the future workstation.
- **Faster talk:** replies capped at about 25 words; turns without a tool call 0.7-1.8 s (was 2.3 s); turns with a tool call 2.2-3.7 s. Skipping the second model round was tested and rejected: Muse always puts a future-tense preamble next to tool calls.
- **Daily streak:** "N days in a row" (days with a finished step, in the person's time zone) in the top bar on wide screens; the done count moves to the top bar on phones.
- **Press feel:** no stuck pressed states, no long-press menus, hover only on devices that hover.
- **Design finish review:** the shipped Impeccable finish reviewer returned **fix** (not ship); all 8 material fixes plus 2 live-test bugs were applied. The verdict pass that scores those fixes did NOT run (time). DESIGN.md was written from the shipped code and is committed. Its sidecar `.impeccable/design.json` and the review screenshots were lost when the worktree was removed; regenerate with the `impeccable-documenter` agent.
- **Docs:** `docs/SUBMISSION.md` (description, both Meta fields, 3-minute shot list, demo-account prep, checklist), README updated, Linear VI-306 to VI-318.

### How it was verified
- Every merge: tsc, eslint, `next build`, 8 self-checks (`day-flow`, `desk-rows`, `agent`, `speak`, `session-json`, `streak`, `tz`, `listen-check`).
- Production: page and every route answer; on Vi's account the first card painted in 220 ms and setup appeared (left untouched for Vi).
- End to end on a local production build with real Muse and Neon as the fake user `agent-test@zeno.local` (all its rows deleted afterwards): setup, import, opening with options, quick replies that used the imported notes, a 5-step roadmap from a tool call, desk, focus timer, DONE stamp, check-in.
- Not verified: speaking into a real microphone (needs Vi), Safari and Firefox, motion beyond still frames.

### Known issues
- The instant cache is keyed by first name, the date and part of the day; it is cleared on sign-out, but two accounts with the same first name on one browser could briefly see each other's cached card. Fix: add a stable account key to `DayResponse`.
- Low items from reviews: a double-tap can answer two setup cards; failed setup saves are silent; an hours-old cached opening can be spoken if `/api/day/opening` fails; the desk closes when a text selection is dragged past its edge; no fold-back animation on close.
- After a chip tap Zeno speaks but does not open the mic; the mic opens only on Talk or "Something else". Deliberate (no surprise hot mic); confirm with Vi.

### Next steps (in order)
1. Vi: do the first-run setup on production, then press Talk in Chrome and speak (real mic, Meta voice input).
2. Run the finish-review verdict pass (fresh `impeccable-finish-reviewer` over new screenshots of `/preview`), then regenerate `.impeccable/design.json`.
3. Demo account prep and the video (VI-317, `docs/SUBMISSION.md`).
4. Calendar block (VI-315), then prep pack (VI-316); mail actions on the desk (VI-314) only if time remains.
5. The known issues above.

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

## 4. What is live (main = production)

| Commit | What |
|---|---|
| ff2f9a8 | Session 1 foundation: Google token refresh, user time zone (`src/lib/tz.ts`), honest sources, `reasoning_effort`, chat history, parallel context, Achernar voice |
| de74604 | Muse Voice Transcribe realtime relay (`/api/listen`, `listenMeta`) |
| 263fd6b, 7f5d950, 71108df | PRs #1-#3 (agent core, voice loop, Index Card screens), merged by Vi |
| d8b95a2 | Real voice hook restored, `listenAuto`, "Still up?" greeting, extended `src/lib/day.ts` contract |
| bc97e56, 4962493, a7dcc91 | Instant day + opening endpoint + options + memory save/import; tap-first UI + setup + press feel; desk |
| ac25ca2, f83989b | Finish-review fixes + DESIGN.md; daily streak |

## 5. In flight

Nothing. All branches are merged into `main`; all worktrees were removed. Old local branches (`feat/*`, `design/finish`, `fix/foundation`) can be deleted.

## 6. Remaining work

See "Next steps" in section 0, the Linear issues VI-306 to VI-318, and `docs/SUBMISSION.md`. Deferred past Nov 4 (record as unmet, per C09): journal, undo, drag planner, travel-aware conflicts, overfull-day tradeoffs, durable background work, email sending, Productive News, scheduled reflection, MCP, team mode, native apps.

## 7. How to work in this repo

- Fresh checkout: `npm ci`, then `npx next typegen` (otherwise tsc fails on `LayoutProps`). If tsc complains about deleted routes, delete `.next/dev` (stale generated types).
- Checks before any merge: `npx tsc --noEmit --incremental false`, `npx eslint src/`, `npx next build`, every `src/**/*.check.ts` (plain `node`), `node scripts/listen-check.mjs`.
- Next 16 with `cacheComponents: true`: never export `runtime`, `dynamic`, `revalidate`, `fetchCache` or `dynamicParams` from a route; `maxDuration` is fine.
- Voice locally: `npx vercel@65.7.0 dev --local` (plain `next dev` cannot upgrade WebSockets; Zeno then falls back to Web Speech).
- Testing signed-in flows without touching Vi's account: run `next start` with `AUTH_TRUST_HOST=true`, mint an Auth.js session for `agent-test@zeno.local` with `@auth/core/jwt` `encode` (salt `authjs.session-token`, the app's AUTH_SECRET, never printed), use `http://127.0.0.1:<port>` (an old httpOnly cookie on `localhost` blocks it), and delete that user's rows afterwards.
- Env var names (values in `.env.local` and Vercel, never in git): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `META_MODEL_API_KEY`, `GOOGLE_TTS_API_KEY`, `DATABASE_URL`.
- Muse facts (tested): `muse-spark-1.3` always reasons; `reasoning_effort: "minimal"` gives a first token in about 1-2 s; tools plus a strict `response_format` json_schema work in one request; tool calls arrive with a future-tense preamble that must never be spoken as the result; `tool_choice` only supports `"auto"`; Meta has no TTS.
- The server runs in UTC: use `src/lib/tz.ts` for anything about "today" or clock times.
- A `/preview?state=<name>&theme=<light|dark>` gallery shows every screen in `next dev` (it is a 404 in production).

## 8. Open items for Vi

- Go through first-run setup yourself, then try Talk with the real mic in Chrome.
- Google OAuth audience: confirm in Google Auth Platform > Audience; if it is in Testing, add dotcainha@gmail.com as a test user. Testing-mode refresh tokens expire after 7 days, so sign in again before the Nov 9 finals.
- "Import contacts": read as importing context (pasted notes). Say if you meant Google Contacts.
- Rotate the Meta and Google keys after Nov 4 (they were pasted into a chat once); restrict the Google key to the Text-to-Speech API.
- Local-only files (gitignored or untracked on purpose): `PRODUCT.md`, `.impeccable/` (design contract, decision sketches, detector config), `zeno-onboarding.html`.

## 9. History notes

- Session 1 (2026-10-29): onboarding, research, foundation fixes, Meta voice relay, PRs #1-#3. Vi merged them; the PR #3 merge kept the `use-voice` stub (fixed in session 2).
- Session 1 privacy note: one headless voice test used this Mac's real microphone (about 10 s of ambient audio to Chrome's speech service; local log deleted).
- Session 2 privacy note: during a production test at 1:28 AM Zeno auto-listened for a few seconds after speaking before Claude stopped it; all later tests muted audio and used typing only.
