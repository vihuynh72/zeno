# Zeno: the Nov 2 round (Vi tested the live app)

Vi used production on Nov 2 and asked for a simpler, less confusing flow, better memory, important-only mail, Canvas,
and no calendar clutter. This file holds Vi's 16 answers and the build spec. Where it disagrees with docs/PLAN-NOV.md,
this file wins. Vi records the demo video on **Nov 4, before 6 PM PT**: production must be stable by the morning of Nov 4.

## What Vi said
- "Noted · Undo" is annoying. Save silently instead of showing it.
- Memory should remember better and line up: the Memory list is messy, and the card, the plan and the calendar disagree
  (on Nov 2 the card said "Read first page and note ideas", the plan said "Read first half and mark notes", the calendar
  said "Read chapter 4 for HIST 110"). Zeno should not ask questions to learn about the person; it learns from use.
- The calendar is fine to look at, but don't build a calendar. Zeno should not write to the calendar unless the person
  asks, or for a big commitment. Small to-dos never go on the calendar.
- The workflow is confusing: bigger buttons, less clutter.
- The inbox shows unimportant, very long mail. Show only important mail, with a subtle way to open Gmail.
- Canvas: connect with a token so Zeno can help with homework. "Help students prep or event prep beforehand but not do it
  for them; instead, it's like helping them find the first step to complete the work, or untangle."
- Resend: not needed. For mail the person has to send, Zeno drafts it in their Gmail.

## Decisions (Vi's answers, Nov 2)
1. **Home: one card, one big button.** The header holds only the Zeno mark, the streak and the account avatar (no date
   or time, no Sound button: Sound moves into the account menu). No stage tracker ("Brief · Pick one thing · First step
   · Focus" goes). The card shows the step's title, its minutes, and one meta line (goal · due). Under it, one big
   full-width button ("Start · 5 min"). Anything else is a small text link under that button ("Something else"). At
   the bottom: one big Talk button, with small text links Type · Today · Memory.
2. **Flow: Card → Focus → Done.** Every screen has one big button; anything else is a small link under it.
   - Card: [Start · N min], link "Something else".
   - Focus: the timer and the step; [Done]; small links "Stuck?" and "Stop for now" (plus "Draft it in Gmail" when the
     step is an email to write).
   - Done: "Nice. Next: <next step>, N min" with [Keep going] and a small "That's enough today".
   - "Stop for now" and "That's enough today" save the place and bring it back next time.
   - No "See the plan" screen.
3. **Calendar writes: big or asked-for only.** Zeno never puts small to-dos on the calendar. It offers a block (still
   one tap to book) only when the person asks for one ("put it on my calendar"), or for a commitment of **60 minutes or
   more**. Pasted notes never propose blocks or all-day "Due:" events. Bookings already made keep their Undo.
4. **Week view: read-only, opens Google.** The whole day fits without scrolling, titles are not cut off, and tapping an
   event opens it in Google Calendar. No editing inside Zeno.
5. **No quiet lines.** Remove all of them: "Noted: … · Undo", "Kept on this device: …", "Added N …" and the visible
   heads-ups. Memories save silently; the person reviews and forgets them in Memory. Heads-ups are only spoken, when
   sound is on.
6. **Memory: tidy, aligned, learned from use.**
   - One name per task: the card, the plan and any calendar block use the step's saved title.
   - A tidy list: near-duplicates merge into one fact; classes, shifts and other events the calendar repeats are not
     saved as separate facts (the calendar is read live every day); finished and stale to-dos clear.
   - Learn from use, never ask questions to learn: no setup questions, and talk never asks "when do you focus best?".
     What they finish, skip, how long steps really take, and when they work become the facts.
7. **First sign-in: scan, then the card.** Zeno reads calendar and email (and Canvas if connected), says in one line what
   it found, then shows the first card. No questions. "Paste notes" stays as a small optional link.
8. **Inbox: important mail only.** People and school, never promotions, social, updates, forums or no-reply senders.
   One line each (sender · subject, no preview text), and a subtle "Open Gmail" link to the person's Gmail.
9. **Canvas: personal access token, kept only on the device.** Vi tests with Vi's own SJSU Canvas and shows it in the
   video; Vi creates and pastes the token (agents never type tokens). Zeno reads the next 14 days of unsubmitted
   assignments, quizzes, discussions and exams.
   - They become deadlines in the plan.
   - The first card can pick one and break it into steps from its instructions.
   - The prep pack uses the instructions to find sources.
   - Zeno helps prep and find the first step or untangle the task. It never writes answers, drafts the work, or
     submits anything.
10. **Health facts stay generic, even on the device.** Never name a condition or medicine: "Doctor check-in Nov 3", not
    "ADHD check-in". (On Nov 2 the vault held "Attends ADHD check-in with Dr. Lee on November 3.")
11. **Email: drafts, no sending service.** For an email the person owes ("Email Prof Patel my project group"), Zeno
    writes a short draft and opens it in their Gmail compose window; they press Send.
12. **Demo account.** Before recording, reset Zeno's data for dotcainha@gmail.com and keep Maya's 18 calendar events
    and 8 emails. (Zeno greets "Hi De" because the Google name is De Bruyne; renaming it in Google is Vi's call.)
13. **Music for deep work** (Vi, later on Nov 2): on the Focus screen, a small "Music" link puts on chill, working or
    study music, only open-license or public-domain tracks (credited where the license asks), plus brown noise made in
    the browser. It plays only while focusing. Files are downloaded only after Vi approves each one (name, source,
    license, size).

## The contract (commit "chore: contract for the Nov 2 round")
- `src/lib/day.ts`: `MemorySource` gains `"canvas"`; `DayResponse.mailUrl?`; `WeekEvent.link?`; `TalkResponse.draft?`
  and `EmailDraft`; `CanvasAssignment`, `CanvasResponse`, `CanvasBrief`; request bodies take `canvas?: CanvasBrief[]`
  (opening, talk) or `canvas?: CanvasBrief` (prep); `ImportResponse.proposal` is always `[]`.
- `src/lib/canvas-store.ts` (done): the device-only Canvas link and briefs; `syncCanvas(account)` posts to
  `/api/canvas`, saves the link and the 3 soonest briefs when Canvas accepts it, and forgets a refused link.
- Stubs to fill: `src/components/canvas-sheet.tsx` (desk-ui), `src/lib/canvas.ts` and `src/app/api/canvas/route.ts`
  (memory-canvas), `src/components/focus-music.tsx` (built by Claude after Vi approves the tracks; flow-ui only places
  `<FocusMusic active={screen === "focus"} />` among the Focus screen's small links).

## Tracks
Each track works in its own worktree and branch from the contract commit and changes only the files it owns. If a
track needs a change in a file it does not own, it says so in its report instead of making it.

### flow-ui
Owns `src/components/guided-day.tsx`, `day-view.tsx`, `day-flow.ts` (+check), `account-menu.tsx`, `streak-row.tsx`,
`voice-ring.tsx`, `booking-chip.tsx`, `noted-line.tsx`, `prep-pack.tsx`, `src/app/globals.css`, `src/app/page.tsx`,
`src/app/preview/*`. Decisions 1, 2, 5, 7, and the client side of 3, 9 and 11.

### desk-ui
Owns `src/components/desk.tsx`, `desk-rows.ts` (+check), `week-grid.tsx` (+check), `memory-sheet.tsx`,
`canvas-sheet.tsx`. Decisions 4, 8 (display), the Memory sheet's tidy display (6), and the Connect Canvas sheet (9).

### brain
Owns `src/lib/agent.ts` (+check), `brief.ts`, `calendar.ts` (+check), `gmail.ts`, `context.ts`, and the routes
`src/app/api/talk`, `day`, `day/opening`, `import`, `calendar/*`. Decisions 3 (server rules), 4 (event links), 6 (one
name per task, no questions in prompts), 8 (important-only mail, `mailUrl`), 9 (Canvas briefs in the opening and talk
prompts) and 11 (the draft tool).

### memory-canvas
Owns `src/lib/goals.ts` (+check), `profile.ts` (+check), `patterns.ts` (+check), `vault.ts` (+check), `prep.ts`
(+check), `canvas.ts` (+ a new check), `scripts/memory-bench.mjs`, and the routes `src/app/api/canvas`, `goal`, `prep`,
`profile/scan`, `memory`, `steps`. Decisions 6 (tidy memory, learning from use), 9 (Canvas server side, prep with
instructions) and 10.

## Nov 2 evening: the tidy round
Vi connected their real school Canvas on production and said: "it looks kind of messed up a little bit. It looks kind
of messy… It doesn't have the context. I think it needs some sort of AI to organize it a little bit… It looks so messy,
as you can tell." Every screen showed Canvas's raw text (a term, a section and the long course name before each title,
a proctoring note after it), Memory listed each Canvas deadline on 2-3 lines, Focus didn't say what the step was for,
and Sources pushed the timer off screen. Built on `tidy/canvas-data`, `tidy/sheets` and `tidy/focus`, merged on
`tidy/integrate`:
- **Clean at the source** (`src/lib/canvas.ts`): a course shows as its code ("FA26: HIST-110 Sec 02 - US History Since
  1865" → "HIST 110"; a name without one keeps at most 28 characters, cut at a word), a title loses its proctoring note
  ("Quiz 4 (Ch. 4) - Requires Respondus LockDown Browser + Webcam" → "Quiz 4 (Ch. 4)"), and a deadline is saved whole
  ("HIST 110: Essay 2, due Friday, November 6."). The next sync replaces the old rows.
- **One line per row**: the Canvas screen lists every assignment due in the next 2 weeks by day (Today, Tomorrow, the
  weekday, then the date), as course · title · time, each opening in Canvas. Memory sums Canvas up in one line ("Plus 11
  assignments from Canvas · See them", which opens that screen). Today's deadlines take one line each.
- **Focus keeps the context**: "<goal> · due <when>" sits under the step, and Sources is one small ruled card (a title
  and a why per source, a line each) that scrolls clear of the dock.
- **Connect re-plans the home card** at once when Canvas found work still due, on the home card only. An open plan
  stays first (one plan at a time); letting a sooner Canvas deadline take over the card is Vi's call. Disconnect deletes
  the Canvas deadlines Zeno saved (`DELETE /api/canvas`), also when a page-load sync ends after it.
