# Zeno: the Nov 4 overnight round (goals for anyone)

Vi, the evening of Nov 3: the app is "in a terrible position". It should work as a selective workflow for anyone's
goals, not only classwork. Vi asked for a test with Claude in Chrome and 10 simulated people.

**Vi's answers (10:30 PM):**
1. **Goals:** a sidebar on a laptop. All goals sit on the left and the open goal's desk on the right. On a phone, the
   list is the home.
2. **Life goals:** a rolling plan. When the steps run out, Zeno plans the next few. A goal can carry a rhythm, like
   "3 runs a week".
3. **Video:** Maya plus one life goal.
4. **Overnight:** "Everything, record later".

Then Vi went to bed: "work autonomously… make sure the workflow is good so any users can comfortably use it for any
goals and it has to fit the mission statement."

**Mission (PRD):** "Other AI does your work. Zeno gets you to do it." From "I should" to "I did".
- Zeno does the managing: people never have to sort or arrange; Zeno proposes and one tap confirms.
- Not goal software with boards to keep tidy.
- Never does the work.
- Quiet by default.

## What the test found
The 10 simulated people:
- Maya (student with ADHD)
- Jordan (job hunt)
- Priya (nurse and mom, phone)
- Sam (5K)
- Lucia (English for an interview, Spanish first)
- Kenji (Etsy shop)
- Ruth (67, phone)
- Alex (burned out: a bill and the landlord)
- Amara (thesis and a talk)
- Dana (a judge)

Plus Claude's own test in Chrome. Come-back scores averaged 2.8 of 5. The full synthesis is in the scratchpad
(`sim/synthesis-round1.json`).

**Works:**
- One sentence or a photo becomes a specific timed plan in seconds.
- Start, a quiet timer, Done, the stamp, then Keep going feels good to everyone.
- Stop for now is guilt-free.
- Coming back works.
- Typed help in the moment is excellent.

**Broken:**
- Zeno's replies are invisible on the goal page (9 of 10), so plans change "by themselves".
- Next, Start and Zeno disagree.
- "Make it smaller" hands over the bigger piece or deletes work.
- A running step shows duplicate or contradicting buttons ("Start now" resets the timer).
- There is no front door: "I couldn't find much yet", then "your goals are below" with none, a hidden "Add a goal" and
  "Plan tomorrow" at 10 PM.
- Dates and whole goals get dropped when people name them.
- The Week is blank.
- Bars read 0-done as progress.
- Every goal becomes a short one-off checklist that never finishes the job.
- Jargon and school leftovers ("Find sources", "Desk") tell non-students it isn't for them.
- On a phone the dock hides buttons.
- Without Google, people see error-sounding lines.

## The changes (four tracks)

### A. shell: the goals sidebar, the front door, adding a goal
**Laptop (≥1024 px): two columns.**
- **The left column (about 320 px), the goals panel:**
  - "+ Add a goal" sits on top. A tap opens a text box in place at once, with no AI turn.
  - Every open goal follows as a row:
    - the title
    - a thin bar that fills only with finished steps
    - "Next: <step> · N min"
    - the due line ("due Thu Nov 12 · 9 days left") or the rhythm ("3 runs a week")
  - Goals are in deadline order, with undated goals last. The order stays stable across reloads.
  - The open goal is highlighted.
  - Under the goals, "Suggestions" lists deadlines from Canvas or email with no plan yet ("Plan it") and email that
    asks something ("Answer Prof. Patel").
- **The right column:** the open goal's desk. With no goal open, it shows the greeting card and one line, "Pick a goal
  on the left, or add one." With zero goals, it shows the front door.

**Phone:** the home is the hello plus the goals panel, full width. A goal opens its desk full screen with "← Goals".

**The front door (zero goals):**
- One line says what Zeno does: "Tell me a goal. I'll break it into small steps and stay with you while you do them."
- A visible text box, "What do you want to get done?", with placeholder examples from school and life ("Run a 5K by
  January", "Finish my portfolio site by Friday", "Study for my CS exam next Thursday").
- [Make a plan], with "Add from a photo" under it.
- Typing creates the plan directly through `POST /api/goal/add { text }` (`AddGoalRequest`). The desk shows
  "Planning: <their words>…" with the person's words visible until it answers.
- `others` (more goals from one message) join the panel.

**Copy and defaults:**
- Never "your goals are below" with zero goals.
- No "Plan tomorrow", "Wind down" or "It's late" defaults.
- The first-run button says "Start", not "Start my day".
- The first-run line never apologizes ("I couldn't find much yet" → "Nothing to read yet, so let's start with what you
  want to do.").

**The header:**
- "Desk" becomes "Today" (the sheet with Today and Week).
- The account menu keeps Memory, Sound, Privacy and Sign out first. "Connect Canvas" and "Connect an app" sit under a
  small "Connections" heading.

**Input and the dock:**
- "Something else" never opens the mic. It opens the text box. Only Talk opens the mic.
- The text box closes after Send and never sits inside or over the card. It docks in one place above the dock.
- On a phone, leave room above the dock so no button or chip is ever under it.
- Each new view opens at its top.

### B. desk: the goal page and Focus
- **Zeno's words always show.** Every reply shows as a visible line under the card, and a reply that asks a question
  shows its tap answers. This covers a new goal, a plan change, Make it smaller, Show me how, and talk during a step.
  Speech is extra, never the only channel.
- **One Next everywhere.** The card, Start, the panel row and the page after a reload always name the same Next step.
  After a plan change, Next is the first new or reworded step in plan order.
- **A running step:**
  - The big button is always Done.
  - The small links: Stuck? · Stop for now · Pop out (desktop only) · Music.
  - Zeno's tap answers show as extra links only when they add something. They are never "Start now", "Not now", a
    second Done or a second Stop for now, and nothing resets the timer.
  - A reload mid-step shows the same screen.
- **Stuck?** shows three taps, and asks nothing:
  - **Make it smaller:** a 2-5 minute first piece added before the step, made Next. A running clock keeps running on
    it.
  - **Show me how:** Zeno's first move or an example, shown as its line.
  - **Switch goal.**
  - Stop for now stays.
- **The goal strip:**
  - The title, then "due Thu Nov 12 · 9 days left" or the rhythm.
  - The bar fills only with finished steps; the current step gets an outline, never a red fill.
  - Counts use a plain 0, in the sans font.
  - The strip stays in view in Focus and after Done (sticky in the desk column). No jump-scrolls.
- **The steps list:**
  - The next 5 steps show, and the rest sit under a collapsed "Later (N)".
  - The last step finishes the goal (the server plans it that way).
- **Materials:** "On your desk" becomes "For this step". "Helpful links" (the old Find sources) shows only for reading
  or research steps, or when someone taps "Find links".
- **A rolling goal (rhythm set):**
  - When its last open step is done, the client calls `POST /api/goal/next { id }` and shows "Planned your next few:
    …".
  - The strip says "3 runs a week · week 2".
- **A small credit:** "Steps by Muse, Meta's AI", in grey at the foot of the desk.

### C. server: adding goals, rolling plans, and Zeno's judgment
- **The database:** `goals.rhythm` TEXT, added through `ensureSchema` with ADD COLUMN IF NOT EXISTS. `goalFrom` and
  `openGoals` carry it.
- **`POST /api/goal/add { text }`:**
  - One Muse call (strict JSON, minimal effort) reads the person's words into up to 3 goals. For each:
    - a specific title in their words ("Call hospital billing about the $1,400 bill")
    - a due date when they said one, resolved in their time zone ("next Thursday", "Nov 22", "in 3 weeks"), never in
      the past
    - a rhythm when the goal keeps going
    - steps:
      - **Project goals:** 4 to 10 steps, where the first takes at most 5 minutes and the last one finishes the job
        (submit, send, order, publish).
      - **Rhythm goals:** the next 3 to 5 sessions, sized honestly.
  - `privateTitle` runs on everything, and the same-title check applies.
  - The first goal is saved as current and the rest paused. The answer is `GoalResponse` with `others`.
  - When the words hold no goal: `bad-request`.
- **`POST /api/goal/next { id }`:** for a rhythm goal, Muse plans the next 3-5 sessions from the done steps' titles and
  the rhythm, and appends them. A goal with no rhythm gets `bad-request`.
- **`/api/day`:** adds `doneThisWeek` (`DoneStep[]`), the steps finished from Monday 00:00 in the person's zone,
  newest first, at most 50.
- **Talk (`agent.ts` prompts and tools):**
  - **Make it smaller:** insert a 2-5 minute first piece before the step and keep the original. Never delete, merge or
    reorder steps the person didn't mention.
  - **Finishing:** `finish_step` only when the person says they finished. A question or one choice never finishes a
    step.
  - **Due dates:** `update_steps` (or a small new `set_due` tool) can set a goal's due date. When the person names a
    date for an existing goal, use it, and resolve "next Thursday" against today in their zone.
  - **Several goals in one message:** each becomes its own goal (`set_goal` per goal) with a specific name. Steps never
    land in another goal.
  - **Corrections:** when asked "is this correct?", answer first with the corrected sentence in quotes and one short
    reason. Never praise a wrong sentence.
  - **Facts:** never invent facts about the person; ask one tap question instead.
  - **Words:** plain words, no jargon ("shell", "mock", "keep pile", "blocker", "kill avoidance"). Phrases to say go in
    quotes.
  - **Feelings:** when someone says they feel sick, guilty or rejected, the first sentence is warm and short.
  - **School leftovers:** never for life goals.
- **The photo prompt:** read any list, letter, email screenshot, flyer or handout into a goal. When there is nothing:
  "I couldn't find a to-do list in that photo."
- **The rule opening and options:** no night defaults ("Plan tomorrow", "Wind down", "It's late").

### D. today and week: the sheet
- **Today:**
  - When mail or calendar was never connected (no access), the sheet shows the goals plus one quiet line, "Connect
    your calendar and mail (optional)", never "Sign in again" or an error.
  - Everywhere it uses the same word: "Connect".
- **Week:**
  - Each day lists its finished steps ("Done: Pick a role · 5 min", from `doneThisWeek`) and the goals due that day.
  - Goals due later sit under "Coming up" with their days left ("Thesis chapter 2 · Dec 15 · 42 days · 4 steps left").
  - Undated goals sit under "Ongoing", with their rhythm.
  - Arrows move to the previous and next week.
  - "Nothing due this week" never shows while goals exist.
  - Durations read "2 h 5 min".

## Ownership
| Track | Owns |
| --- | --- |
| **shell** | `day-view.tsx` (the outer layout, the home, the front door, the header, the dock and text box); a new `goals-panel.tsx`; `account-menu.tsx`; `globals.css` (layout rules); in `guided-day.tsx`, the add-goal flow (`addGoal` → `/api/goal/add`), panel selection and the "Something else" behavior. In `day-flow.ts`, only new helpers in a new section |
| **desk** | `goal-desk.tsx`; `focus-pop.tsx` and `pop-card.ts` if needed; in `guided-day.tsx`, the focus, stuck, answers, next and reply-line logic; the desk section of `day-view.tsx`; existing helpers and checks in `day-flow.ts` |
| **server** | `src/lib/agent.ts`, `brief.ts`, `goals.ts`, `db.ts` (the rhythm column), `gmail.ts` if needed, with their checks; the routes `api/goal/add` and `api/goal/next` (new), `api/day`, `api/talk` |
| **week** | `desk.tsx`, `week-goals.tsx`, `goal-rows.ts`, `desk-rows.ts`, with their checks |

`shell` and `desk` both edit `guided-day.tsx` and `day-view.tsx`. Each keeps to its own regions, and the integrator
merges. Shared types live in `src/lib/day.ts` (contract commit) and are never changed by a track.

## Done when
- All checks pass, and each track's report lists built, skipped, needed and risks.
- Claude merges and reviews, tests in Chrome as a new person (local production build, a throwaway user), and runs the
  10-person simulation again.
- It is fixed, deployed, live-checked, and reported in the morning.
