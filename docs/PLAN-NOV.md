# Zeno: the follow-through build (Nov 1 → Nov 4)

Decided with Vi on 2026-11-01 (30 questions). This file is the spec every build track works from.
Deadline: 2026-11-04 6:00 PM PT. Judging: Impact 30%, Meta AI use 25% ("beyond a basic integration"),
technical depth 20%, demo 25%.

## The promise

**Zeno gets you to start and finish.** A chat app waits for a prompt, never touches your real day,
leaves once the plan exists, and never learns whether you did it. Zeno runs a follow-through loop:

1. **Shows up with the answer**: the first card is the one most urgent thing with a 5-minute start.
2. **Puts it on your calendar**: finds real free time and books it on a separate "Zeno" Google calendar.
3. **Starts with you**: a timer plus short spoken check-ins, and a heads-up before your next class.
4. **Learns from what you did**: what you finished or skipped, how long it really took, when you start.
5. **Knows you**: a grouped profile built from what you say and, with permission, your calendar and email.

Demo persona: **Maya, a student with ADHD** (classes, a campus job, deadlines). Demo account:
dotcainha@gmail.com. Never write test data to Vi's own account. The demo shows two memory moments:
Zeno knows Maya right after sign-in, and day 2 is visibly smarter because of day 1.

## Decisions (Vi's answers)

### First card and flow (keep the guided card: no tabs)
- The first card is **one thing with a 5-minute start; one tap starts the timer**. Zeno picks the most urgent
  item (current goal's next step, else the nearest deadline or to-do) and says why in one short line.
- After picking something else: a **plan card** with the steps, the deadline and one big Start. Never skip
  the plan; never start a timer the person didn't tap.
- **Instant taps, words follow**: a tap acts at once (timer starts, plan shows, block books). Zeno's sentence
  and voice arrive a moment later. Text shows whole at once; no word-by-word gating.
- **Urgent first**: steps that unblock others or are due soonest go first ("email the professor about an
  extension" before "draft results"), with a one-line reason.
- **First steps are 5 minutes** (or what the person's memory says works for them). Later steps stay short.
- **After Done: the stamp and straight to the next step.** No check-in question.
- **Focus mode: short spoken check-ins** at the start, halfway and the end (one sentence each), with a mute toggle.
- **Warnings**: an event starting soon gets a line on screen and spoken ("Heads up, Bio lab in 10 minutes"),
  including during focus.
- **Hands-free after the first Talk**: once the person taps Talk, the mic reopens after each spoken question
  until they tap stop. The first mic use is always their tap.
- Fix the dead ends found on Oct 31: "Stop for now" offers to book the next step; every spoken question has
  tap answers (including in focus); no stale card flash on reload; the paste box's red rules no longer
  strike through the text.

### Calendar (all four, fully)
- A separate **"Zeno" Google calendar**, created on first booking, holds Zeno's blocks and deadlines.
- **Find free time** across all of the person's calendars.
- **Booking takes one tap per suggestion** ("Tomorrow 9:30–9:40: email Prof Patel. Book it?"). After pasting
  notes, **one tap adds the whole batch**. Nothing is ever written without a tap (Meta's rules for Muse
  require confirming calendar writes). Booked blocks can be undone.
- **To-dos and deadlines go straight onto the calendar**: deadlines become all-day "Due: …" events, to-dos
  become short timed blocks at free times. Every to-do is also kept as a "projects" memory reading "To do: <title>"
  until it is booked (or the day after it is due), so nothing pasted is lost, even when the batch is never booked or
  there is no calendar write access (Vi, Nov 1; review fix: a proposal alone was lost on reload).
- **Deadline memories expire** the day after the due date; past due dates are refused for new plans (Vi, Nov 1).
- **Week view: a grid like Google Calendar**, opened from the Today button.
- **Warnings before events** (see flow).

### Memory and profile ("memories are the key to remembering Maya")
- When Zeno learns something, a **quiet "Noted" line with Undo** appears, and it is saved to memory.
- **Grouped profile**, about 120 facts, each group keeps its freshest: About you · Routines ·
  Projects & deadlines · Interests & goals · People · How you work best · Patterns Zeno noticed.
- **Profile scan from Google** (with the sign-in permission): calendar (past and next 30 days) **plus full
  emails**. Learn school, work and routines; projects and deadlines; interests and life goals; key people;
  and interests or habits from purchases and events that help motivate (fitness or weight-loss goals,
  habits to break). **Overall health is kept, privately, when it helps planning, and nothing more specific**:
  never a medicine's name, so keep the effect ("Mornings feel foggy lately.").
- **Private facts stay on the device** (Vi, Nov 1: "Zeno will not store any of those data any where except there
  devices"). Two lists, in the prompts (`NEVER_KEEP`, src/lib/ai.ts) and in `factVerdict` (src/lib/profile.ts), the
  server's backstop, so a fact the model failed to mark still never reaches the database:
  - **Private, device only**: overall health (a condition, or how it affects energy, sleep or focus; when someone
    simply focuses best is not health), sexual orientation (nothing more), religion and practice, politics,
    immigration or visa status, and balances, debts or money owed. The model marks them (`private` on the remember
    tool, on pasted-notes items and on scan facts). Talk, import and the scan return them in `private` (talk with a
    "kept-private" action, so a Noted line is backed); the browser keeps them (src/lib/vault.ts) and sends their texts
    back as `private` with talk, the opening and the scan (which lists them as already known).
  - **Never kept anywhere**: passwords, sign-in codes, verification links, medicine names, sexual or reproductive
    details beyond orientation, other people's private matters, and text that reads as instructions to Zeno (the
    person's own notes and titles skip that last guard: "Read the lab instructions" is a real to-do).
  - Nothing private reaches the database, Google or the logs: a private to-do or deadline is never a "To do:" memory
    or a proposal; a goal, step or block title with a private detail is refused so the model words it again, and a
    first-card pick with one falls back to the rule pick. Mail from or about sexual health, religion, politics,
    immigration or money still never reaches the scan's model (widening that is open for Vi). Store facts, never the
    emails themselves.
- After the first scan, a **"Here's what I learned" card** in setup: each fact with a tap to remove.
- **Re-scan once a day, quietly** (first open of the day); new facts show as a Noted line.
- **Learn from behavior**: finished or skipped steps, real duration versus estimate, time of day.
  A new pattern becomes a "Patterns Zeno noticed" memory, said in one line ("You finish 5-minute starts at
  night"), and plans adapt to it. A pattern that stops holding is removed automatically; one the person removed
  (Undo or Forget) is never saved again (Vi, Nov 1).
- The memory benchmark (`scripts/memory-bench.mjs`) must keep passing; it covers groups and, apart, the vault
  (private facts returned and used, never a row; never-list facts kept nowhere).

### Streaks (all four mechanics)
- **One finished step counts** for the day, even 5 minutes.
- **One rest day per week** (Mon–Sun), used automatically: a single missed day doesn't break the streak.
  Days before the first finished step are `none` (a neutral dot), never `missed`.
- **Evening save-your-streak**: after 6 PM local with a live streak and nothing finished today, the first card
  offers "One 5-minute step keeps your 6-day streak going" with a one-tap start.
- **Milestones** at 3, 7, 14, 30, 50, 100 days: a bigger stamp and a spoken line.
- Show **streak + "N steps this week"** with the week's seven dots, on every Done and in the top bar
  (phones too). Best streak is kept; after a break, no shame: "Day 1 again. Your best is 9."
- Booking tomorrow's step says "Tomorrow's streak is planned."

## Contract (src/lib/day.ts holds the types)

Routes, all `{ state: ... }` JSON:

| Route | Owner | What it does |
|---|---|---|
| GET /api/day | contract | adds `free`, `deadlines`, `calendarWrite`, `progress` to the existing day |
| GET /api/day/opening | brain | adds `pick: FirstPick \| null` (the one thing, ready to start); POST `{ private }` uses the device's facts |
| POST /api/talk | brain | adds `proposal: CalendarBlock[]` (suggested bookings, nothing written; only when the body sends `proposals: true` and calendarWrite is "ok"), `progress` when the turn finishes a step, and `private` (device-only facts, each with a "kept-private" action); body `private` carries the device's facts |
| POST /api/goal | brain (new) | saves a plan deterministically; `start: true` also starts step 1 (instant taps) |
| POST /api/import | brain | returns grouped `memories` (every to-do a "To do:" memory until booked) plus, with calendar write access, a `proposal` of deadlines and to-dos to book; private facts, to-dos and deadlines come back in `private` instead |
| GET /api/calendar/week?start=YYYY-MM-DD | calendar (new) | 7 days of events from all calendars, Zeno blocks marked |
| POST /api/calendar/free | calendar (new) | `{ minutes, days? }` → free slots that fit |
| POST /api/calendar/book | calendar (new) | `{ blocks: CalendarBlock[] }` → books on the Zeno calendar, links steps |
| DELETE /api/calendar/book/[eventId] | calendar (new) | undo a booking |
| POST /api/profile/scan | profile (new) | scans calendar + email once a day (`{ first: true }` in setup; `private` lists the device's facts as known) → `learned`, and `private` for the device |
| GET/POST /api/memory, DELETE /api/memory/[id] | profile | memories carry `group` and `source` |
| PATCH /api/steps/[id] | streak | also returns `progress` and `learned` (a new pattern) |

Library functions the tracks share (stubs land with the contract; owners fill them in):
- `freeSlots(accessToken, timeZone, { minutes, days })` and `upcomingDeadlines(accessToken, email, timeZone)` in
  `src/lib/calendar.ts` (calendar track).
- `progressFor(email, timeZone)` in `src/lib/progress.ts` (streak track).
- `learnFromSteps(email, timeZone)` in `src/lib/patterns.ts` (streak track): returns a new pattern memory or null.
- `addMemory(email, text, { group, source, expiresOn? })` in `src/lib/goals.ts` returns the saved memory, or null
  when it was already known or the person removed it (for anything Zeno found itself).

Database (all additive, `ensureSchema`): `memories.memory_group`, `memories.source`, `steps.event_id`,
`steps.scheduled_at`, `goals.due`, `memories.expires_on`, and a `user_state` table (`zeno_calendar_id`,
`profile_scanned_at`, `forgotten`).

## Tracks and file ownership

Backend first (parallel), then UI (parallel), then review and live testing.

- **Calendar**: `src/lib/calendar.ts`, `src/auth.ts` (scopes, granted-scope tracking), `src/app/api/calendar/**`,
  `setStepSchedule` in `src/lib/goals.ts`.
- **Brain**: `src/lib/agent.ts`, `src/lib/ai.ts`, `src/lib/brief.ts`, `dayToText` in `src/lib/context.ts`,
  `src/app/api/{day/opening,talk,import,goal}/**`.
- **Profile**: `src/lib/profile.ts`, `src/lib/gmail.ts`, `src/app/api/profile/**`, `src/app/api/memory/**`,
  memory functions in `src/lib/goals.ts`, `scripts/memory-bench.mjs`.
- **Streak**: `src/lib/progress.ts`, `src/lib/patterns.ts`, step-history functions in `src/lib/goals.ts`,
  `src/app/api/steps/**`.
- **Flow UI**: `src/components/{guided-day,day-view,voice-ring}.tsx`, `src/components/day-flow.ts`,
  `src/lib/use-voice.ts`, `src/app/globals.css` (flow sections), `src/app/preview/**`.
- **Week UI**: `src/components/desk.tsx`, `src/components/desk-rows.ts`, new `src/components/week-grid.tsx`.

## Guardrails
- Model output is untrusted: validate every tool argument, time, title and URL at the boundary.
- Never send personal data to `*-contributor` models; always set `reasoning_effort`.
- Confirm every calendar write with a tap; never claim a booking the API didn't confirm.
- No pet names ("love", "babe"); warm, candid friend; one or two short sentences.
- Secrets stay in `.env.local` / Vercel. Never print or commit them.
- Every new non-trivial function gets a `*.check.ts` self-check.
