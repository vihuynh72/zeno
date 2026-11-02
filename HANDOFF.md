# Zeno handoff

Last updated: 2026-11-01, 8:10 PM PT, by Claude (session 3, the follow-through build and the live test).
Read this first, then the Linear doc **"Zeno hackathon build plan (Nov 4)"** (project Zeno, team VI).

## 0. Session 3 (2026-11-01): the follow-through build and the live test

Spec: `docs/PLAN-NOV.md` (Vi's 30 answers and the Nov 1 privacy rule). Memory benchmark: `docs/MEMORY-BENCH.md`.
Linear: VI-319, VI-321 and VI-315 Done; VI-320 and VI-322 In Progress until the daily re-scan, spoken heads-ups and
hands-free are checked live.

### Live on main (production, 341dd7a)
- **Backend** (a4eef78):
  - Calendar: a separate "Zeno" calendar, free time, booking with Undo, the week, and deadlines.
  - Brain: the first-card pick, deterministic plan saves (`POST /api/goal`), and booking proposals.
  - Profile: grouped memory and the Gmail and Calendar scan.
  - Streak: a rest day, milestones, and patterns with hysteresis.
- **Vault contract** (8b73157), **UI** (cf5a48a: merges of feat/flow-ui, feat/week-ui, feat/vault, plus 3 fixes):
  - The first card with "Start · 5 min".
  - The plan card with booking chips.
  - The Noted line with Undo.
  - Streak dots.
  - The grouped Memory sheet and the account menu.
  - Focus check-ins, heads-ups and hands-free.
  - The Week grid.
  - **Private facts stay in the browser**: `zeno.vault.<account>`, cleared at sign out. Routes take them as `private: string[]` in the body and never save them.
- **First-card fallback** (5e344c2): a new person whose only work is pasted to-dos still gets a first card with Start.
- **Live-test fixes** (merges 3e478cb to be597a1 from a workflow's three tracks, then four follow-ups, 9ff2e36 to 341dd7a):
  - Pasted to-dos: at most 30 minutes, 2 a day, 8 AM to 9 PM, 10 free minutes after each, in the part of the day
    they focus best, looking 5 days ahead.
  - A deadline their own calendar already shows that day is not added again. Today, the opening and the first-card
    pick still list it, because they read deadline memories too.
  - Code and bank mail never reaches the model (judged by its text, not only its subject), and the day saved in the
    browser keeps only that it came.
  - Today lists the card's bookings and takes them out of Free. A booking offer has one Book chip. Sound off is
    remembered. The setup summary leads with plans. "Added N" clears after setup.
  - A five-line first card fits a 14-inch laptop (the compact rhythm now starts at 900px tall), and answers that land
    under the dock scroll clear of it.

### How it was verified
- All checks pass on 341dd7a: typegen, tsc, eslint, build, 15 self-checks and listen-check; day-flow and week-grid
  also in LA and Tokyo time.
- Memory bench on the integrated build (run mvyplle4): overall 100.0, privacy 100.0, no leaks.
- **Live on the demo account dotcainha@gmail.com** (Nov 1, 6:30 to 8:05 PM PT), seeded as a student, Maya: 18
  calendar events and 8 self-sent emails, including a fake verification code and a doctor's reminder.
  - Sign-in with every scope; the scan learned her classes, shifts, deadlines and focus habits.
  - The doctor visit was kept only in the browser vault, without the diagnosis. The medicine name and the code were
    never stored (database checked directly).
  - Booking and Undo on real Google: the setup batch, a plan chip, a talk offer. The first booking created the Zeno
    calendar.
  - After the fixes, five pasted to-dos landed Mon 8:00 and 8:40, Tue 8:00 and 10:15, Wed 8:00. The first run had
    crammed them into Sunday 6:35 to 9:30 PM.
  - Start, focus, Done (a Day 1 streak), Stop for now offering the next step for tomorrow, the Week grid, Today and
    the Memory sheet.

### Not verified yet
- Tomorrow's daily re-scan, the spoken heads-up before an event, the halfway and end check-ins, and hands-free
  listening (the mic stayed off at night).
- Safari and iOS, dark mode in a live run, and 390x844 since the answers scroll fix.

### Known issues
- **Talk and Stop-for-now offers ignore the to-do spacing**: they can sit right after another block (8:50 after an
  8:40 to 8:50 block).
- **A talk or plan offer can book a to-do the import already booked.**
- **A 60-minute to-do becomes one 30-minute block**, and booking it drops its "To do:" memory, so the rest is not
  tracked.
- **Near-duplicate facts** between the paste or setup answers and the scan ("Lab report 3, due Friday" and "Owes BIO
  lab report 3 due November 6").
- **On Sunday the Week grid shows the week that is ending.**
- **The greeting uses the Google first name**: the demo account says "Hi De" (its name is De Bruyne).
- **The mail filter is broad**: mail whose text says "pin", "password" or "code 48291", even in a footer, is left
  out of the scan, and subjects with "code", "security" or "payment" hide ordinary school mail from the opening.
- **Undo of a Noted fact is guarded only in the browser.** The model can replay the undone request from the history,
  and its reply can still say it saved it.
- **Reload shows the saved line for 2.5-4 s** before the new pick.
- **The Google access token is readable from `/api/auth/session`** (pre-existing). It can now also write the Zeno
  calendar.
- **Once about 120 facts are in the person's own words, scanned facts and patterns stop saving.**
- **Undated "To do:" memories never clear.**

### The demo account now
- Its own calendar holds the seeded semester. The Zeno calendar holds 5 to-do blocks and 2 "Due:" days from the
  second run. Zeno has its memories, a 1-day streak, and 1 vault fact in Chrome.
- To start fresh before recording: undo each Zeno event (`DELETE /api/calendar/book/{id}` for the `zeno` events in
  `/api/calendar/week`, both weeks), delete that email's rows in steps, goals, tasks, memories and user_state, and
  clear the browser's localStorage keys that start with "zeno".

### Next steps
1. Vi decides: reset the demo account before recording, keep or remove the seeded test data, rename the Google
   account.
2. The demo video and submission (VI-317), due Nov 4, 6 PM PT.
3. After Nov 4: rotate the Meta and Google keys.

## 0b. Session 2 (2026-10-31, 1:21-4:21 AM PT, autonomous while Vi slept)

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


### Results (all live on main = production, commit 87caf2d)
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
- **Prep pack (VI-316):** on the plan card, "Find sources" asks Muse Spark through the Responses API with the built-in `web_search` tool for 2-3 sources for the current step (`POST /api/prep`, `src/lib/prep.ts`, `src/components/prep-pack.tsx`). Only the goal and step titles are sent; URLs are validated (https, real host, length) and stored on the step (`steps.prep` jsonb, added by `ensureSchema`, already present in the production database). Live: 4-7 s, 2 searches, real sources (NHS Couch to 5K, OpenStax limit laws); about $0.005 per prep.
- **Hardening:** the instant cache is keyed by an opaque account key (HMAC of the email, never the email); another tab or account can no longer write its day back; a double-tap cannot answer two setup cards; failed setup saves are said plainly; a stale model opening is never kept or spoken; the desk no longer closes when text selection is dragged past its edge.
- **Final design review (fresh reviewer, 3:45 AM):** disposition "fix" with 7 material items, all applied in 87caf2d: memory facts wrap in full (4 shown on laptops, 3 on phones, "+N more in Memory"), the dock is sticky so it never falls below the fold, quiet pills keep ink text, phone step titles and inbox subjects wrap to two lines, prep sources use the ruled mini card, the empty progress row is hidden when signed out. The reviewer viewed 19 of 53 captures and judged motion from stills only; its note that the desk "sits in a sheet" is wrong (verified live: it opens in the middle of the page). `.impeccable/design.json` was regenerated locally; DESIGN.md still does not describe the prep pack or the streak.
- **Docs:** `docs/SUBMISSION.md` (description, both Meta fields, 3-minute shot list, demo-account prep, checklist), README updated, Linear VI-306 to VI-318.

### How it was verified
- Every merge: tsc, eslint, `next build`, and the self-checks (`day-flow`, `desk-rows`, `agent`, `speak`, `session-json`, `streak`, `prep`, `tz`, `listen-check`, plus `goals.check.ts`, which needs `DATABASE_URL` and writes then deletes a throwaway user).
- Production: page and every route answer; on Vi's account the first card painted in 220 ms and setup appeared (left untouched for Vi).
- End to end on a local production build with real Muse and Neon as the fake user `agent-test@zeno.local` (all its rows deleted afterwards): setup, import, opening with options, quick replies that used the imported notes, a 5-step roadmap from a tool call, desk, focus timer, DONE stamp, check-in.
- Not verified: speaking into a real microphone (needs Vi), Safari and Firefox, motion beyond still frames.

### Known issues
- First paint can still show the previous account's saved card for a moment on a shared browser (the account is only known once `/api/day` answers; the card is then dropped). Fixing it fully needs a JS-readable account cookie.
- Prep pack: URLs are checked for shape but not matched against the actual search results, so a plausible invented link could slip through; no rate limit on `/api/prep` (same exposure as `/api/talk`); private-IP hosts are not blocked; the first source link takes focus after a search.
- Low items from reviews: when every setup save fails the summary still opens with "All set"; a save that fails after "Start my day" is silent; no fold-back animation when the desk closes.
- After a chip tap Zeno speaks but does not open the mic; the mic opens only on Talk or "Something else". Deliberate (no surprise hot mic); confirm with Vi.
- Copy to confirm with Vi: failed setup saves read "I couldn't save N of your answers. Tell me again anytime."
- Short laptop screens: a step title of three or more lines can push the primary pills partly under the sticky dock until the person scrolls.

### Next steps (in order)
1. Vi: do the first-run setup on production, then press Talk in Chrome and speak (real mic, Meta voice input).
2. Run the finish-review verdict pass (fresh `impeccable-finish-reviewer` over new screenshots of `/preview`), then regenerate `.impeccable/design.json`.
3. Demo account prep and the video (VI-317, `docs/SUBMISSION.md`).
4. Calendar block (VI-315); mail actions on the desk (VI-314) only if time remains.
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
| 412490b, 76ac1fd, 3ddaf78 | Hardening (account-keyed cache, double-tap guard, honest save failures, no stale openings); prep pack with Muse web search |
| 87caf2d | Final design review fixes (memory facts, sticky dock, quiet pills, wrapping, card-world sources) |

## 5. In flight

Nothing. Everything through 341dd7a is merged into `main`. Workflow worktrees under `.claude/worktrees/` and old local branches (`feat/*`, `integrate/*`, `design/finish`, `fix/foundation`) can be deleted.

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
- Google OAuth: the app is published and unverified (100-user cap). People see Google's "hasn't verified this app" screen and click Advanced, then Go to Zeno. Declaring the scopes under Data Access is only needed for verification.
- "Import contacts": read as importing context (pasted notes). Say if you meant Google Contacts.
- Rotate the Meta and Google keys after Nov 4 (they were pasted into a chat once); restrict the Google key to the Text-to-Speech API.
- Local-only files (gitignored or untracked on purpose): `PRODUCT.md`, `.impeccable/` (design contract, decision sketches, detector config), `zeno-onboarding.html`.

## 9. History notes

- Session 1 (2026-10-29): onboarding, research, foundation fixes, Meta voice relay, PRs #1-#3. Vi merged them; the PR #3 merge kept the `use-voice` stub (fixed in session 2).
- Session 1 privacy note: one headless voice test used this Mac's real microphone (about 10 s of ambient audio to Chrome's speech service; local log deleted).
- Session 2 privacy note: during a production test at 1:28 AM Zeno auto-listened for a few seconds after speaking before Claude stopped it; all later tests muted audio and used typing only.
