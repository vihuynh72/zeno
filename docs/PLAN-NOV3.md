# Zeno: the Nov 3 round (a goal-first day)

Vi used production on Nov 3 and found the flow weak:
- "Greeted with a freaking app right away."
- "I don't see the goal."
- "I don't see the workstation."
- The inbox "you can't even interact with."
- Week "looks absolutely like Today."
- A "Type" button under Talk that is "kind of weird."

Vi asked Claude to draw one user's experience screen by screen and to interview Vi about it. The storyboard is on a page
only Vi can open: https://app.superset.sh/page/zeno-storyboard-rzwf8n. The interview was 8 questions.

This file holds Vi's answers and the build spec. Where it disagrees with `docs/PLAN-NOV2.md`, this file wins. It is
built the night of Nov 3, and Vi records the video on Nov 4.

## Vi's answers (Nov 3, about 1 PM PT)
1. **Workstation: both.**
   - The home is a hello with goal options. Tapping a goal opens that goal's desk, the workstation around the step.
   - A "Desk" link in the header opens working cards: goals, mail, deadlines and the calendar.
2. **Greeting: the hello, then the options, on one screen.** The hello has her name, yesterday's win, and her free
   time until the next event.
3. **She picks the goal; Zeno picks the step.**
   - The home asks "What are we working on?" and lists up to 3 goals.
   - Zeno does not mark one of them as its pick.
4. **Timing:** build tonight, record Nov 4.
5. **A tapped goal opens its desk.** The desk holds:
   - the goal bar
   - Zeno's next step, with Start
   - the goal's other steps
   - its materials
6. **Mail: asking mail first.**
   - Emails that ask her something come first, with a draft reply.
   - The rest of the important mail follows.
   - Every email opens in full inside Zeno.
7. **Week: goals across the week.**
   - Each day shows what is due, how many steps are left, and her free time.
   - The calendar grid stays one tap away.
8. **"Stuck?": show another option.** Zeno offers a smaller step or another goal, without asking why.

Claude's calls (Vi can override):
- A keyboard icon beside Talk replaces "Type".
- Memory moves into the account menu.
- The header gets a "Desk" link.
- The home has no "Not today" link, because choosing a goal is the choice.
- "Something else" stays.

Why, in short:
- A few options with reasons raise motivation; many lower it (Patall, Cooper & Robinson 2008).
- Effort rises as a goal gets closer, so the goal and its progress stay in view (goal gradient; Amabile & Kramer's
  progress principle).
- Help works where the work happens, with time made visible (Barkley's point of performance).
- People go back to work left open, so a stop names the next step (Ghibellini & Meier 2025).
- No guilt after a slip, because forgiving yourself for a slip leads to less putting off (Wohl, Pychyl & Bennett 2010).

## Screens

### Home: the hello and the goals (screen "ready", no plan opened yet, no step running)
- **Greeting** (large, bold), by the person's local time:
  - "Morning, Maya." from 5:00 to 11:59
  - "Hey Maya." from 12:00 to 16:59
  - "Evening, Maya." from 17:00 to 4:59
  - Before 5 AM it keeps today's "Still up?" behavior.
  - With no first name: "Morning." and so on.
- **Zeno's line** under the greeting:
  - The rule opening paints at once. The model's line replaces it when `/api/day/opening` returns, as today.
  - Neither line starts with a greeting or the name (see server 8).
  - With sound on, Zeno says "<greeting> <line>" once, as today.
- **A label:** "What are we working on?"
- **Up to 3 option cards** (index cards, each one big tap target), from `homeChoices` in `day-flow.ts`:
  - **plan** (an open plan):
    - Title: the goal.
    - Right side: the next step's minutes.
    - Grey line: "3 of 7 done · due Fri" ("3 of 7 done" with no due date).
    - Last line: "Picks up where you stopped." for the current plan, otherwise "Next: <next step title>".
  - **deadline** (due within 7 days, with no open plan whose title matches it):
    - Title: the deadline.
    - Grey line: "not started · due Thu".
    - Last line: "Due today.", "Due tomorrow." or "Due Thursday.".
  - **mail** (the newest email with `asks`):
    - Title: "Answer <sender's name>", with "2 min" on the right.
    - Grey line: "Email · <sender's name>".
    - Last line: the subject on one line.
  - **Order:**
    1. The current plan comes first when it has an open step.
    2. Then the other plans and the deadlines, by due date (no due date last).
    3. When an asking email exists, it takes the third slot, so at most 2 plans or deadlines come before it.
    4. Fill to 3.
  - **Title match:** both titles in lowercase, every run of characters that are not letters or digits made one space.
    They match when either title contains the other.
- **"Something else"**, a small link under the options: Talk when this browser can listen, otherwise typing, as today.
- **No options at all:** Zeno's line and today's quick replies, as the ready screen does now.
- **First sign-in:** the scan is unchanged, and "Start my day" leads to this home.
- The old first-pick card (`FirstPick`) no longer shows. Keep the type for days saved earlier.
- A step that is running when the page opens goes straight to Focus on its goal's desk, as today.

### The goal's desk (after she taps an option, a Goals row or a deadline)
- **Opening it:**
  - **plan:** `POST /api/goal/activate { id }`. The desk shows at once from `day.goals`. If the call fails, a small
    line says "Couldn't open that. Try again".
  - **deadline:** `POST /api/goal/plan { title, due, canvas? }`. `canvas` is the matching assignment from this
    device's Canvas briefs. While it waits, the desk shows the title, the due date and the card "Breaking it into
    steps…", with no Start.
  - **mail:** `POST /api/goal` with `{ title: "Answer <name>", steps: [{ title: "Reply to <name> about <subject, cut
    to 40 characters>", minutes: 2 }] }`.
    - If the API refuses that title, fall back to "Answer an email" and "Reply to the email".
    - Remember the email's id for that goal in `localStorage["zeno:mailgoal:<account>"]` as `{ [goalId]: emailId }`.
      Store ids only, never the text.
- **Top to bottom:**
  1. A small "← All goals" link back to the home. The plan stays current.
  2. **The goal strip:**
     - The title, bold, on the left; "due Fri" on the right.
     - A segmented bar, one segment per step: done steps in ink, the proposed or running step in red, the rest in the
       track color.
     - Under it, "3 of 7 done".
  3. **The next step card:** "Next: <step>", with its minutes on the right.
  4. **The big button:** "Start · N min".
  5. **Small links:**
     - "Something smaller" sends Talk `Make "<step>" smaller: a first piece of 2 to 5 minutes.` The talk agent's
       `update_steps` changes the plan, and the desk redraws.
     - "Another step" proposes the next todo step, and cycles.
  6. **"Steps":** one line per step.
     - A done step shows ✓ and its real minutes, when its start and done times exist.
     - The proposed step shows ▶.
     - Tapping a todo step proposes it.
  7. **"On your desk"**, the materials, each a small card:
     - **The prompt · <course>:** for a Canvas match (`canvasFor`), the first 220 characters of its instructions, and
       "Open in Canvas".
     - **Where you stopped:** the newest done step, as "<title> · done today|yesterday|<weekday> in N min".
     - **The email** (mail goals): from, subject, and the text from `GET /api/mail/[id]`.
       - While it loads: "Opening the email…".
       - On error: "Couldn't open it.", with "Open in Gmail".
     - **"Find sources for this step":** today's prep pack, run in place on a tap. It never fetches on its own.
- **Start:** `startStep` on the proposed step, as today, then Focus.

### Focus, on the desk
- Same desk. The next step card becomes the step card, with today's stopwatch, check-in line and "Back.".
- [Done], then the links "Stuck? · Stop for now · Music". "Draft it in Gmail" is added for an email step, and
  `isEmailStep` must match "Reply to …".
- The bar's segment for the running step is red. The steps and the materials stay below.
- **"Stuck?"** asks nothing. The card shows two links:
  - "Make it smaller", the same as "Something smaller".
  - "Switch goal": the step goes back to todo, as "Stop for now" does, and the home shows.

### Done, and stopping
- **Done:** as today (the stamp, the sound, the streak row and [Keep going]), plus:
  - The bar fills, and its caption says "4 of 7 · over halfway" once more than half is done.
  - The line: "Nice. Next: <step>, N min.". When known, add "You have 1 h 25 min until PHIL 134." (from today's events
    and free slots).
  - Links: "Switch goal · That's enough today".
- **The last step:** "That's all of <goal>." and the button [Back to my goals], which goes home.
- **"Stop for now" and "That's enough today":** as today. The wrap line adds "Today: 2 steps, 41 min." when it is
  known.

### Header and dock
- **Header:** the Zeno mark (tap: home), a "Desk" link (opens the Desk on Today), the streak, and the avatar menu.
- **Dock:** Talk as today, with a round keyboard button to its right (aria-label "Type to Zeno"; it does what Type does
  today). No text links under Talk.
- **Account menu:** "Memory" first, which opens the Memory sheet.

### The Desk: Today (the working cards)
Four cards, in this order:
1. **Goals.** Each open plan (`goals`, or `[goal]` for days saved before Nov 3):
   - The title, the segmented bar, and "3 of 7 done · due Fri".
   - The whole row is a button: `onGoal(id)`.
   - When there are none: "No plans yet. Pick a deadline below."
2. **Mail.** "Asks you" (`asks`) first, then "Other mail".
   - A row shows the sender and the subject. An asking email also shows the snippet's first line in grey.
   - A tap opens the email in place: "Opening the email…", then the full text from `GET /api/mail/[id]`.
     - The text sits in a block about 280 px tall that scrolls, and keeps its paragraphs.
     - "Reply" (also a small link on other mail) calls `onReply(email)`.
     - "Open in Gmail" goes to `mailUrl + "#inbox/" + id`, https only.
   - One email is open at a time.
   - The text stays in component state only: never in storage, never logged.
   - A row with no id (a day saved earlier) does not open, as today.
   - The "Open Gmail" link stays at the bottom.
3. **Deadlines.** As today, but each row is a button: `onDeadline(deadline)`. A deadline that matches an open plan
   shows that plan's bar instead of "not started".
4. **Today.** The day's events and free time, as today.

### The Desk: Week (goals across the week)
- Rows from Monday to Sunday of this week, in the person's time zone. Today is marked and past days are grey.
- **Each day:**
  - The goals due that day: deadlines on that date, and open plans due that date, merged by title match.
  - For each goal: the title, the bar when it has a plan, and "4 steps left · about 1 h 30" (the sum of its todo
    minutes), or "not started".
  - The free time between 8 AM and 10 PM, from that day's events: "3 h free".
  - A past day says "Worked" when `progress.week` says "done".
- A tap calls `onGoal` or `onDeadline`.
- A "Calendar" link switches to today's grid, and "Goals" switches back.

## Rules
- **Instant first paint.** The home paints from the saved day and `/api/day`; no model call comes before it.
- **Fewer model calls.** The only new call is `POST /api/goal/plan`, when she taps a deadline with no plan. Sources
  stay on a tap. Nothing summarizes email.
- **Privacy:**
  - An email's text passes through the server in memory only. It is never stored, logged, saved in the browser or
    sent to the model.
  - Canvas instructions reach the model in `/api/goal/plan` and `/api/prep`, and in Talk as before (the opening no
  longer gets them).
  - Plan and step titles go through `privateTitle`.
- **One current plan.** Opening a plan makes it the current one; the others are paused, not lost. Talk, Focus and the
  check-in keep working on the current plan.
- **Calendar:** unchanged (`PLAN-NOV2` §3).
- **Copy:** the direct tone (US0011), short. No emoji, never "behind".
- **Saved day.** Bump the saved day's version, so a day saved before Nov 3 never paints the new home with an old
  greeting.

## The contract (commit "chore: contract for the Nov 3 round")
- `src/lib/day.ts`:
  - `DayEmail.id`, `DayEmail.address` and `DayEmail.asks`
  - `DayResponse.goals`
  - `Choice`, `ActivateRequest`, `PlanRequest` and `MailResponse`
- `day-view.tsx`: `on.openGoal`, `on.openDeadline`, `on.reply`, and `DayViewProps.goals`.
- `desk.tsx`: `DeskProps` gains `goals`, `progress`, `onGoal`, `onDeadline` and `onReply`.
- `guided-day.tsx`: passes `day.goals`, with stub handlers.

## Tracks
Each track works in its own worktree and branch from the contract commit, and changes only the files it owns. If it
needs a change in a file it does not own, it says so in its report and does not make it.

### server
**Owns:**
- `src/lib/goals.ts`, `gmail.ts`, `brief.ts` and `agent.ts`, with their checks
- `src/app/api/day/route.ts` and `src/app/api/day/opening/route.ts`
- the new routes `src/app/api/mail/[id]/route.ts`, `src/app/api/goal/activate/route.ts` and
  `src/app/api/goal/plan/route.ts`

**Builds:**
1. **`openGoals(email)`:** active or paused goals with at least one step that is todo or doing.
   - Order: the current goal first, then by due date (no due date last), then the most recently updated.
   - At most 5, each with its steps.
2. **`activateGoal(email, goalId)`:** one transaction pauses the current goal (if it is a different one) and makes
   this one active. It returns the goal, or null when the goal is not this person's or is done.
3. **`/api/day`:**
   - Adds `goals` from `openGoals`.
   - Each email gains `id`, `address` (from the From header) and `asks`.
4. **`asks(subject, snippet, fromSelf)`**, exported from `gmail.ts`, with a check:
   - True when the subject or the snippet has a "?", or (ignoring case) one of: can you, could you, would you, will
     you, please, let me know, are you, do you, rsvp, confirm, reply, available, when can.
   - Never true for mail the person sent.
5. **`GET /api/mail/[id]`:**
   - The id must match `^[A-Za-z0-9_-]{6,64}$`.
   - Reads the message with `format=full`, using the person's own token.
   - Returns `from`, `address`, `subject`, `date` (ISO) and `text`. `text` is the cleaned plain text (reuse the
     scan's body cleaning), capped at 6,000 characters.
   - Gmail's 404 becomes `not-found`.
   - Never logs or stores the text.
6. **`POST /api/goal/activate`:**
   - Checks the session, and checks `{ id }` with `isId`.
   - Calls `activateGoal` and answers with `GoalResponse`; an unknown or done goal is `bad-request`.
7. **`POST /api/goal/plan`:**
   - **Body checks:**
     - title: 1 to 120 characters
     - due: YYYY-MM-DD, not before today, or null
     - canvas: checked like `cleanCanvas`, with instructions of at most 2,000 characters
   - **The model call:** Muse (the client in `src/lib/ai.ts`, `AI_MODEL`, `reasoning_effort` minimal, strict JSON)
     returns 3 to 7 steps.
     - Each step has a title of at most 60 characters and 2 to 45 minutes. The first step is at most 5 minutes.
     - Steps help her start and prepare, and never do the work. Drafting is hers to do.
     - It uses the Canvas instructions when they are given.
   - **Titles:** `privateTitle` on every title.
   - **When the model fails, or refuses:** a rule plan with three steps:
     - "Open <title> and read what it asks", 5 minutes
     - "List the parts it needs", 10 minutes
     - "Do the first part", 25 minutes
   - **Saving:** `setGoal(email, title, steps, due)` saves the plan; it pauses the old current plan, which is intended.
     Answers with `GoalResponse`.
8. **The opening line** (the rule line in `brief.ts`, and `openingPrompt` in `agent.ts`):
   - No greeting or name at the start, because the home shows those. No pick and no question.
   - One or two short sentences, at most 25 words.
   - It says what she finished yesterday (or her streak), any new pattern, and her free time until the next event
     ("You're free until PHIL 134 at 1:30.").
   - Keep the day-2 pattern behavior and its `noticed` (US0013), and the direct tone (US0011).
   - Stop asking the model for a pick: `pick` is always null.
   - Keep `options` as they are, because Talk uses them.

**Checks:**
- `agent.check.ts`: the new opening rules.
- `asks`.
- The plan route's body checks.
- `openGoals` ordering, as a pure sort helper.
- Never run against a real account.

### flow-ui
**Owns:**
- `src/components/guided-day.tsx`, `day-view.tsx` and `day-flow.ts` (with its check)
- `account-menu.tsx`, `booking-chip.tsx`, `streak-row.tsx`, `voice-ring.tsx` and `prep-pack.tsx`
- `src/app/globals.css`, `src/app/page.tsx` and `src/app/preview/*`

**Builds:**
- The home, the goal's desk, Focus on the desk, Done and stopping, the header and dock, and the account menu.
- The three Desk callbacks: each closes the sheet, then does what the home's option does.
- `homeChoices(...)`, a greeting helper, the bar caption, and the "until the next event" text in `day-flow.ts`, with
  checks.
- The saved day's version bump.
- **Preview gallery states**, all with made-up data (course codes only, never Vi's real Canvas):
  - `home-goals`, `home-goals-mail` and `home-empty`
  - `goal-desk`, `goal-desk-canvas`, `goal-desk-email` and `goal-desk-planning`
  - `desk-focus`, `desk-stuck`, `desk-done` and `desk-last-step`

### desk-ui
**Owns:**
- `src/components/desk.tsx`, `desk-rows.ts` (with its check) and `week-grid.tsx` (with its check)
- a new `week-goals.tsx`, plus its pure helpers and their check
- `memory-sheet.tsx` and `canvas-sheet.tsx`

**Builds:**
- The Desk's Today cards and the Week, as above.
- `GET /api/mail/[id]` is called from the Desk.

## Done when
- **All checks pass:**
  - `npx next typegen`
  - `npx tsc --noEmit --incremental false`
  - `npx eslint src/ scripts/ --max-warnings 0`
  - `npx next build`
  - every `*.check.ts` and `scripts/*-check.mjs`
- Each track reports what it built, what it skipped, and any change it needed in a file it does not own.
- Light and dark both work, and nothing is cut off on a phone or a 1440×900 laptop.

## Recording on Nov 4 (changes to `docs/DEMO-NOV4.md`)
- **Order:**
  1. Shot 6 (day 2) first, before anything else opens the demo account.
  2. The reset.
  3. Shot 3 (the first sign-in, now landing on the new home).
  4. Shot 4 (a goal's desk, Focus, Done).
  5. Shot 5 (Talk).
- **The Prof. Patel email (DQ-2) matters more now.** It should ask something, for example "Does Wednesday at 2 or
  Thursday at 11 work for you?". Then it shows as asking mail and as a home option.
