# Zeno handoff

Last updated: 2026-11-04 midday, by Claude (session 4: the Nov 4 day round; before it the Nov 4 overnight round, goals for anyone;
the Nov 3 night round, the Nov 3 goal-first round, the Nov 2 round, the tidy round and the pre-recording build).
Read this first, then the Linear doc **"Zeno hackathon build plan (Nov 4)"** (project Zeno, team VI).

## 0. The Nov 4 day round: the workspace, smarter planning, apps (branch `nov4/final`, Linear VI-365)

Vi tested production at 8:40 AM Nov 4 and said:
- no connectors for other apps
- no way to delete a goal
- "pretty basic", with a boring Week and boring mail
- forwarded mail showed nothing, and some mail couldn't be clicked
- the "Type to Zeno" box cut off the suggestions
- no workstation
- the AI "just names the goal", and should be smarter, more specific and show its thinking
- life and creator goals didn't work

Vi's answers (9-11 AM):
- **Workspace:** three panes on a laptop: goals | the open goal | "For this goal".
- **Planning:** a vague goal gets 1-2 tap questions, then "Muse is planning…" shows its reasoning.
- **Connectors:** Notion, Google Docs/Drive, Slack, Linear, Trello, Jira, Confluence, and Zeno in other AI apps. Each user connects their own workspace.
- **Week:** "Both": done days behind, the plan ahead.
- **Mail:** make it a goal or step, draft a reply, one-line summaries, show all mail. Claude's pick: "Waiting on".
- **Suggestions:** the 3 at a time Vi likes, each with ✕. The next one moves up, hidden ones come back tomorrow. Sources: goals' next steps, mail that asks, app items, "Zeno noticed".
- **Delete:** goals, suggestions and memories can all be deleted.
- **Simulations:** 5-6 personas with diverse goals, not 10.
- **Code freeze:** 2 PM PT.

**Shipped** (agent branches merged into `nov4/final`, each checked; production `8bba60e`):
- `nov4/basics` (91f2007):
  - Remove / Mark done for goals, with a 6 s Undo. The round-7 fix below lengthened it to 30 s+.
  - Talk tools that ask before they act.
  - Forwarded mail shows the forwarded message.
  - Every mail row opens.
  - The dock sizes to what it holds, so nothing sits under it.
- `nov4/workspace` (410ece4): the three panes; Skip and Adjust beside Start; "+ Add goal" always visible.
- `nov4/planning` (05dd6e2, 6106f45):
  - Vague goals get questions in the same model call.
  - The plan returns `thinking` lines.
  - Free calendar times go to the planner.
  - Prompts were tuned for creator and life goals. The eval is in scratchpad `plan-eval/`.
- `nov4/oauth` (360e644): OAuth 2.1 for `/api/mcp` (dynamic client registration, PKCE, refresh). Claude.ai and ChatGPT can add `https://zeno-sigma-topaz.vercel.app/api/mcp` as a custom connector.
- `nov4/apps` (0588646, 4dc5754):
  - The "Your apps" sheet (header "Apps").
  - Linear (pasted key) and Trello (authorize).
  - Google Docs by link, plus "Add a doc" under For this goal.
  - "From your apps" in the add box.
  - `goals.source`.
- `nov4/notion-slack` (3493a4f): Notion and Slack OAuth, server side. Tokens stay on the device (`zeno.connect.<app>.<account>`).
- `nov4/atlassian` (f11dcd7): Jira and Confluence with one pasted Atlassian API token. Only `*.atlassian.net` hosts are fetched.
- `nov4/week-plan` (2faabdd): `planWeek`. Days behind show ✓ done; days ahead get steps spread before due dates and habit sessions with rest days.
- `nov4/mail` (6f1cc9a, f22ab8c): summary lines, Draft a reply (a compose window; no new Google scope), Make it a goal, Add as a step, Show all mail, Waiting on.
- `nov4/feed` (0d579f2): Suggestions as a ranked stack, 3 at a time, with ✕ (hidden for today) and "Zeno noticed" (Keep / Forget). It also adds a "What Zeno remembers" link and a visible Forget in Memory.
- Round-7 fixes:
  - `nov4/fix-ux` (a940854):
    - Remove's Undo lasts 30 s+, then until the next tap.
    - Mark done asks first when steps are left.
    - Skip says "Moved to the end. Undo".
    - The thinking lines come 600 ms apart and stay as "Why this plan".
    - The laptop layout holds still.
    - On a phone, the add box stays above the dock.
  - `nov4/fix-ai` (ad87d9d):
    - "Make it more specific" rewrites the whole plan in one turn.
    - Exams, accountant requests, shops, jobs and parties get one tap question.
    - Field-specific plan rules.
    - `restore_goal` ("bring back my Etsy goal").
- Merge fixes on `nov4/final`:
  - The stack never repeats the coming-back card's step.
  - App items feed the stack, and their goals keep `source`.

**Set up in Vi's browser (Nov 4):**
- **Notion:** connection "Zeno". OAuth, any workspace, read content only, no user information. Redirect `https://zeno-sigma-topaz.vercel.app/api/connect/notion/callback`.
- **Trello:** workspace "Zeno Apps" (free; it only hosts the app) and app "Zeno". Trello Auth API key; allowed origin is production.
- **Vercel production env:** `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` and `NEXT_PUBLIC_TRELLO_KEY` (a Config var, since Trello keys are public).
- **Slack:** waits on a Slack workspace Vi creates. Vi's Slack has only CodeDay and CodePath, which are big community workspaces. Then create the app with user scope `search:read`, redirect `…/api/connect/slack/callback` and public distribution, and add `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
- **Google Drive picker:** not built. It needs Vi's Google Cloud console. Docs work by link.

- **Round 8 fixes:**
  - `nov4/fix8-ui` (201ed16): Suggestions never disagrees with the big card or repeats the open step; "Why this plan" follows a rewrite; Week dates ("by Nov 8" on or before Nov 8; parts of one sitting share a day; rest days only for exercise); Skip's Undo lasts 30 s+; bringing a goal back clears the Removed line; empty "Links" / "From your apps" hide. Vi's "cancel the goal": **Remove this goal** in Adjust and in Stuck?, and "Mark done · Remove" in ink.
  - `nov4/fix8-ai` (49d7570): an exam asks "Which topic is weakest?" and still covers every topic; tapping an answer to Zeno's rebuild question rewrites the plan in that turn; accountant requests ask "What did your accountant ask for?" and name each form's source and the secure portal; creator plans name the craft (3 hooks, batch-filming, posting time, 3-second hold rate); thinking lines are "fact: decision".
  - `e989101`: a talk turn that adds two or more steps puts Zeno's line on top of "Why this plan".
- **"Is this the one?"** `nov4/lookup` (f8cba05, Vi's 12 PM ask: plans need real context):
  - When a typed goal names a real thing (a hackathon, a race, an exam, a program), the first call returns a web query.
  - The server runs one Muse web search (prep.ts, 10 s limit). The card shows title, date, one line and the source, with Yes / A different one / Skip.
  - Yes plans from the facts: the real due date, a thinking line that cites the source, and the page kept as the goal's source ("From the web: …").
  - Live: "I'm doing the Meta hackathon" found the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026, dev.meta.ai) and planned "Build project for Meta hackathon, due today". Everyday goals never look up and aren't slower.
  - Off-switch: `looks` in `src/app/api/goal/add/route.ts`. The add route's limit is now 40 s.
- **Production: `8bba60e`** (12:27 PM). No runtime errors in the 3 h before it. All 43 self-checks, tsc, eslint and the build pass.

**Connected live on production (Nov 4, by Claude with Vi's OK, demo account in Vi's Chrome):** Notion (Class Notes page only, read-only) and Trello (read, 30 days). Both round trips work, and the app's suggestions showed real Canvas items.

**Simulated testing:**
- **Round 7** (six personas on 12d1200): 3.2. Its P0s are fixed above.
- **Round 8** (three personas on f9d94a9): 3.33 (Maya 4, Priya 3, Dana 3). Its P0s are fixed above.
- **After the fixes, Claude checked in Chrome on the final build:**
  - the tax-paperwork question and plan
  - "make it more specific" and "also add…" rewrites, with Why updating
  - the Meta hackathon lookup end to end

**Before recording:**
1. On the demo account, add "I'm doing the Meta hackathon" to show the lookup card, then Yes.
2. Show the workspace: Why this plan, From the web.
3. Show Apps (Notion and Trello connected), Remove with Undo, and the Week.
4. Use mail only if the inbox has a fitting email.
5. Say "done" aloud for Zeno's voice.

**Open questions for Vi:**
- After a confirmed match, should Zeno still ask one question?
- Should bare "do my taxes" ask?
- A "Recently removed" list in the account menu?
- After the video: Slack (needs a workspace Vi owns), the Google Drive picker, and a lookup cache.

**Not verified:**
- the mail actions against a real Gmail inbox
- live Notion, Slack, Trello, Linear, Jira or Confluence accounts
- the Claude.ai and ChatGPT connector flows live
- voice by ear
- iOS Safari's keyboard

## 0. The Nov 4 overnight round: goals for anyone (branch `nov4/goals`, Linear VI-365)

Vi, Nov 3 evening: the app was "in a terrible position"; test it in Chrome and with 10 simulated people, for any goal,
not just classwork. Vi's answers: a goals sidebar on a laptop (the list is the home on a phone), rolling plans with a
rhythm for life goals, the video follows Maya plus one life goal, "Everything, record later". **Spec:
`docs/PLAN-NOV4-GOALS.md`.** Contract `fdbac0b`; four tracks (shell, desk, server, week), each reviewed, merged here;
then review fixes, Claude's own Chrome test, round 2 of the simulation and its fixes.

- **The home:**
  - A first run that found nothing to read opens straight on the front door: "Tell me a goal…", a box ("What do you
    want to get done?", Enter adds a line, Make a plan or Cmd/Ctrl+Enter sends), Add from a photo, Suggestions under it.
  - With goals: the hello card, and on a laptop the goals sidebar on the left (every open goal by due date: title, a
    bar that fills only with finished steps, "Next: …", "due Thu Nov 12 · 9 days left" or the rhythm).
  - Coming back (a reload or a new visit): "Pick up where you left off:" with the current goal's next step and one
    Start. It is the server's current goal, her own last pick, never a new one.
- **Adding goals:** `POST /api/goal/add` reads up to 3 goals from one message (dates in her zone, a rhythm for goals
  that keep going, 4-10 steps whose last finishes the job). Money, health and immigration goals are reworded so no
  private detail is stored ("Sort out the card payment plan"), costing a second Muse call (12-15 s). Goals named in
  talk while another is open are saved for later and join the sidebar at once.
- **The goal page:** Zeno's line always shows under the card; one Next everywhere; while a step runs Done is the big
  button; Stuck? → Make it smaller (a 2-5 min piece before the step; the server moves the running clock onto it) ·
  Show me how · Switch goal · Stop for now; the strip is sticky; the next 5 steps show, the rest under "N more steps";
  "For this step"; "Steps by Muse, Meta's AI".
- **Rolling goals:** a goal with a rhythm never finishes by running out of steps; after its last session (tap or
  talk) or when it is opened with none left, `POST /api/goal/next` plans the next 3-5 ("Planned your next few: …").
  It never changes the current goal.
- **Today and Week:** without Google, the goals plus "Connect your calendar and mail (optional)"; the Week lists each
  day's finished steps (`doneThisWeek`), goals due that day, Coming up, Ongoing, and prev/next arrows.
- **Talk:** finishes only on a said finish ("Sent the email", "Ya lo pagué" count; a question never does); no "Start
  now?" or trailing questions while a step runs; due dates settable ("by Friday"); corrections first for "is this
  correct?"; typed and tapped turns are answered on screen only, spoken ones aloud.
- **Verified:** all 31 checks (every `*.check.ts`, listen-check, day-flow and week-grid in LA and Tokyo), tsc, eslint,
  build. Claude's Chrome test of a local production build as a throwaway user (laptop) and a 390x844 headless phone:
  two goals from one sentence, Start, Make it smaller with the clock carried across a reload, Done, the Week, a due
  date by typing, a goal named mid-step, Show me how, Stop for now, words with no goal, a rolling goal planning its
  next few, a money goal reworded, coming back.
- **The 10-person simulation (same ten personas each round, fresh users, a local production build):** round 1 (Nov 3
  evening) 2.8 of 5; round 2 (1 AM) 3.2; round 3 (2:30 AM) 3.3; round 4 (3:30 AM) 3.5; round 5 (4:15 AM) 3.45; round 6 (5 AM, a regression check) 3.35. Flat since round 4: what is
  left is bigger builds or Vi's calls (below). Reports and syntheses in the
  scratchpad (`sim/synthesis-round2.json` to `-round6.json`).
- **After round 2:** coming back offers "Pick up where you left off" (the current goal's next step, one Start); sending
  from the docked box brings the step and the reply into view; a first run with nothing to read opens straight on the
  front door; Enter adds a line there (one goal a line, up to 5); typed and tapped turns are answered on screen only;
  steps of 25 min or less (a habit session up to 45), up to 12, planned backward from the due date ("Order by …"); a
  job too big for 12 steps becomes rolling work sessions; Today shows each goal's next step and Done today; a goal
  named mid-flow waits unless she says "now" (never while a step runs); `switch_goal`; practice questions are fine;
  "Not now" answers at once; Zeno never claims a save it didn't make.
- **After round 3:** "Your notes" under For this step keep what she said on a step and Zeno's answers (device only,
  cleared at sign-out, Copy) and feed Zeno's memory after a reload; `edit_goal` changes the current goal ("I can do
  4 hours a day") instead of copying it; Start brings the clock to the top; Done stays above the dock on phones; a step
  paused by opening another goal says so; failed typed words come back in the box.
- **After round 4:** coming back says "Pick up where you left off" only for a started goal (else "Start here"), shows its
  due date, and a goal due within 2 days leads; a typed plan edit keeps Next on her step; taps (Done, That's enough
  today) stay silent unless hands-free, while the opening and heads-ups are still spoken; Done stays above the dock
  after long replies on a phone; notes skip taps; "Last done" replaces "Where you stopped"; the Week says "Due · N steps
  left" on a deadline's day; no plan opens on "pick your days"; Zeno never says it tracks or keeps things.
- **After round 5:** coming back's Start works when the card's goal is already the current one (a one-goal account; it
  did nothing in `7ae25a2`); on the desk, Start starts the step Zeno's line names; Zeno says it can't set reminders.
- **After round 5, last:** the first box opens with "Type your goal here, like:"; a finished step's notes stay under
  the next step until it has its own; a sidebar's due line may wrap to two lines.
- **After round 6:** an add or a photo started mid-step keeps the step running until the new plan is saved (a failed
  one returns to Focus with the clock untouched); a step's ref never shows in a tap answer; saves are said "Saved: …";
  a goal or photo she already had opens with a line saying so.
- **Production:** `714e851`, deployed ten times overnight (`64043a5`, `65edf91`, `2b3377f`, `2a91a12`, `33cec97`,
  `7ae25a2`, `3e612ea`, `bf171f8`, `749af72`, `714e851`); no runtime errors in production. Each deploy passed all 31 checks, tsc, eslint and
  the build.
- **Questions for Vi (from the simulation):** Make it smaller: keep the inserted piece (your design) or split the step
  so the plan never grows (7 of 10 asked)? Coming back: keep "a goal due within 2 days leads" (Claude's call tonight)?
  Taps silent (Claude's call; say "done" aloud for Zeno's voice on camera)? A Remove / Mark done for goals? The Week as a
  light plan (steps spread before the due date), and day picking for habits, after the video? One tap question before
  planning when the plan hinges on it? Where the "Muse, Meta's AI" credit lives?
- **Known gaps:** Make it smaller adds a piece before the step (Vi's design; testers in three rounds asked for a split
  instead); habits run as a checklist (no day picker or rest days); the Week doesn't place future steps on days; some
  adds and talk turns take 10-25 s; voice not tested by ear; no Google-connected account tested tonight.

## 0. The Nov 3 night round: more ways in (branch `nov3/extensions`, Linear VI-364)

Vi asked what else would complete the app ("MCP, iOS app, Mac app"). A research run checked six options. Vi chose five,
"big tonight", and main freezes after the video (DQ-4: yes). **Spec: `docs/PLAN-NOV3-APPS.md`.** The contract was
`95e0531`. Five tracks were each reviewed as they landed, then merged here.

- **Photo → plan:**
  - "Add from a photo" sits under the home's goals.
  - The browser shrinks the photo, and `POST /api/goal/snap` has Muse Spark read it (an image part plus strict JSON, at
    minimal effort, in 2-7 s). Its plan's desk opens.
  - The photo is never stored or logged.
  - A browser that can't decode the file (an iPhone HEIC in Chrome) says so.
  - The made-up handout for the video is `docs/demo/handout-phil134.html`.
- **MCP and app tokens:**
  - The `app_tokens` table holds one token per person, hashed; a new token turns the old one off.
  - `POST` and `DELETE /api/app-token`, and the "Connect an app" sheet in the account menu.
  - `/api/mcp` (mcp-handler 2.3.0) has five tools: `list_goals`, `next_step`, `plan_goal` (20 a day), `start_step` and
    `finish_step`.
  - `GET /api/companion/now` and `POST /api/companion/done` serve the Mac clock.
  - Tokens reach goals and steps only.
  - For the video, show Muse Code, never Claude or ChatGPT.
- **Pop-out focus window:** `src/components/focus-pop.tsx`, using Document Picture-in-Picture.
  - "Pop out" shows during Focus only, in Chrome and Edge 116+ and Firefox 151+ on desktop.
  - It is an always-on-top card with the step, the stopwatch and Done, then "Nice. Next:" with Keep going.
  - It never opens by itself.
  - Record the whole display for it, because it is its own OS window.
- **Installable app:**
  - `src/app/manifest.ts`, with icons from the Z mark (`scripts/icons.mjs`). There is no service worker.
  - A signed-out line helps judges past Google's unverified warning.
  - README "Try Zeno" has the install steps.
- **Mac menu-bar clock:**
  - `mac/` is a SwiftPM MenuBarExtra, and `mac/make-app.sh` builds `Zeno Clock.app` (ad-hoc signed, not notarized).
  - It authenticates with the app token, so there is no Google sign-in in the app.
  - It is tested against `mac/mock-companion.py`.
- **Review fixes at merge:**
  - A stale page's "todo" never unfinishes a step finished from the Mac or MCP: a guard in `changeStepStatus`.
  - A paused plan whose last step is finished elsewhere becomes done.
  - A step started 3 h ago or more never shows as running to apps.
  - MCP's optional arguments accept null.
  - The sheet warns that a new token turns off the old one.
  - The HEIC note.
- **Not built (after Nov 4):**
  - an iPhone app with a Lock Screen and Dynamic Island stopwatch (needs Vi's iPhone and Xcode)
  - WhatsApp (its terms bar general AI assistants)
  - OAuth for the Claude.ai and ChatGPT connectors

## 0. The Nov 3 round: a goal-first day (branch `nov3/goal-first`, Linear VI-357)

Vi used production on Nov 3 and found the flow weak:
- greeted "with a freaking app right away"
- no visible goal and no workstation
- an inbox you can't read or act on
- Week looking like Today
- an odd "Type" link

Claude drew one student's day screen by screen. The storyboard is private to Vi:
https://app.superset.sh/page/zeno-storyboard-rzwf8n (source `.claude/pages/zeno-storyboard.html` in the main checkout,
not in git). Claude then interviewed Vi with 8 questions. **Spec: `docs/PLAN-NOV3.md`** (it wins over PLAN-NOV2).

- **Home:** the greeting (shown and spoken) and Zeno's line: yesterday's win and the free time until the next event.
  Then "What are we working on?" with up to 3 goals: open plans, deadlines due within 7 days with no plan, and the
  newest email that asks her something. She picks the goal; Zeno picks the step.
- **The goal's desk:**
  - "← All goals", then the goal bar.
  - "Next: <step>" and [Start · N min], with the links Something smaller · Another step.
  - Every step.
  - "On your desk": the Canvas prompt, where she stopped, the email for a mail goal, and Find sources.
  - Focus and Done happen on the desk. Done fills the bar and shows "over halfway" past the middle.
  - Stuck? offers Make it smaller · Switch goal, and asks nothing.
- **Desk** (header link):
  - Today: Goals, Mail ("Asks you" first, then the rest; every email opens in full in place, and Reply makes it a
    2-minute goal), Deadlines, and today's calendar.
  - Week: goals across the week (what's due, steps left, about how long, free time), with the calendar grid one tap
    away.
- **Dock:** Talk plus a keyboard button. Memory is in the account menu.
- **Server:**
  - `GET /api/day` adds `goals` (open plans) and, for each email, `id`, `address` and `asks`.
  - New routes: `POST /api/goal/activate`, `POST /api/goal/plan` (one Muse call, minimal effort, with a rule plan as
    fallback) and `GET /api/mail/[id]` (the full text, in memory only, `no-store`).
  - The opening never greets, picks or asks; `pick` is always null.
- **Built by:** the contract `e73d4ab`, then three tracks in parallel (`nov3/server`, `nov3/flow-ui`, `nov3/desk-ui`),
  merged on `nov3/goal-first`. All checks passed after the merge: typegen, tsc, eslint, build, and every check script
  (UTC, Los Angeles and Tokyo). The new screens were looked at in `/preview` in light and dark.
- **Behavior changes to know:**
  - "Stop for now", "Switch goal", the mark and "← All goals" put a running step back to todo.
  - A step started under 3 hours ago reopens in Focus on load (a shortcut, tunable).
  - Opening a plan pauses the old current plan (never loses it).
- **Shipped and live-tested on production** (`main` = `8df7d05`, Nov 3 about 3 PM PT).
  - Review fixes: 7, from three reviewers.
  - Live-test fixes: Done kept the goal bar in view, and code or bank mail never opens in Zeno.
  - Vi chose digits for times ("until 2:45").
  - No runtime errors.
- **Demo account reset at Vi's go** (Nov 3, about 3:05 PM PT):
  - No Zeno blocks were on its calendar.
  - `demo-rows.mjs --wipe` removed 3 steps, 1 goal, 24 memories and 1 state row; other accounts were unchanged.
  - The browser keys were cleared, except the Canvas link and Sound (still off).
  - A first sign-in dry run passed: the scan ("learned 14 things, including 4 deadlines"), then Start my day, then the
    new home listing three Canvas deadlines.
  - Today is day 1: Vi uses it for real.
  - Nov 4: shot 6 first, then reset again (same three steps), then shots 3 to 5. Turn Sound on in the account menu
    before recording.
- **For the recording:** see `docs/DEMO-NOV4.md` (updated).
  1. Shot 6 first on Nov 4, then the reset, then shots 3 to 5.
  2. Mail the person sent never counts as asking. The Prof. Patel email (DQ-2) must come from the demo-only mailbox
     and ask a question, or no email shows on the home.

## 0z. Session 4 (2026-11-02): the Nov 2 round

Spec: `docs/PLAN-NOV2.md` (Vi's 16 answers after using production on Nov 2; it wins over `docs/PLAN-NOV.md`). Four
tracks built it on `nov2/brain`, `nov2/memory-canvas`, `nov2/desk-ui` and `nov2/flow-ui`; they were merged, made to
fit and checked on `nov2/integrate`. `nov2/fix` added music for deep work (decision 13, from `nov2/music`) and the
fixes from three reviews. **All of it is on `main` and in production** (Nov 2, 9:25 PM PT: `401c81c`), with the fixes
from the live test below.

### Before recording (on `main` and in production since Nov 3, 3:25 AM PT: `32cef15`; live-tested below)
Four things Vi decided in the Nov 2 brief, built now because that is the PRD default for OQ-2 to OQ-5 (Vi has not
confirmed the timing yet: keep or revert each; stories US0010 to US0013 in `sdlc-studio/stories/`):
- **Reminders off**: Zeno's timed blocks and all-day "Due:" events carry `reminders: { useDefault: false, overrides: [] }`
  (`eventFor`, `src/lib/calendar.ts`). Blocks booked before keep their 10-minute popup. The app gives no heads-up for
  Zeno's own blocks either (`soonEvent`, `src/components/day-flow.ts`); the person's own events still get one.
- **Direct by default**: the persona lines of `ZENO_VOICE_PROMPT` (`src/lib/ai.ts`) push to the next step, name putting
  things off plainly, no "Want to...?" or cheerleading, blunt but never cruel; a reply that points to a next step ends
  in one short yes or no question so the chips stay ("Start now?"). A suggested time is said as open, never as held.
  A slip is not a failure (what's next, never what they lost); a stop or rest is taken in one line with where they
  start next; a plan that won't fit gets a smaller cut offered, never made (`update_steps` deletes the steps it leaves
  out). `RULES`, `NEVER_KEEP` and the tool lines are unchanged, except that remember keeps "any amount, date or time
  they gave". The opening's "soft question" is now "one short, direct question", and the instant rule lines
  (`src/lib/brief.ts`) and talk's fallbacks are direct too ("Next up for PHIL 134 paper: Outline claim 2. Start now?").
- **Done sound**: with Sound on, a tapped or spoken Done (only a real done, never a skip or a failed save) plays two soft
  sine notes made with Web Audio, about 210 ms (`playDone`, `src/lib/speak.ts`), with the DONE stamp, and only while
  the audio context runs: the Done tap wakes it before the save (`wakeAudio`; Safari starts a context only inside a
  tap, and the save's fetch ends the tap), so the sound never waits for a later tap or stacks. Without Web Audio it
  stays silent and Done goes on. A skip said in Focus gets no stamp and no sound, and "Skipped. Next: …".
- **Day 2 names what Zeno learned**: `POST /api/day/opening` takes `heard` (pattern ids this browser already heard, kept
  in `zeno:heard:<account>`, at most 20). The newest pattern memory made in the 7 days before the person's today and
  not heard gets one prompt line ("say it once at the start, in your own words, let it shape the pick") and comes back
  as `noticed: [id]`; the browser adds it to `heard` when that opening shows (`newPattern`/`cleanHeard` in
  `src/lib/agent.ts`). The person's day starts at 5 AM, as for the greeting: a pattern learned today waits for
  tomorrow, one learned at 12:20 AM is last night's and is named that morning, and an opening before 5 AM names
  nothing learned that night.
- **Verified**: typegen, tsc, eslint (src and scripts), build and every self-check, with new asserts (no reminders on
  both kinds of event; the sound's notes, length and level; the persona's wording; the pattern window, heard ids, the
  newest wins and UTC vs Los Angeles day starts; the heard list). Real Muse lines on made-up data, old prompt vs new,
  ten moments (twelve after the review): `docs/TONE-SAMPLES-NOV3.md` (every day-2 run named the pattern first). On a local build as a throwaway @zeno.local user (rows deleted), the real
  route named yesterday's pattern with its id ("You do your best work before noon, so start with Outline claim 2."),
  then, with that id heard, did not; junk `heard` was ignored and a pattern learned today waited. Memory bench, two
  runs on that build (Nov 2: overall 96.1, privacy 96.9): overall 88.6 and 98.6, privacy 96.9 and 100.0, no leaks, no
  false claims, rows deleted. Each run missed a different single turn (run 1 the update, which kept the old Tue/Thu
  shift row; run 2 the remember + set_goal turn), and both missed one import fact (import has no persona). The update
  turn alone, six times each through `talk()`, forgot and saved 6 of 6 on the old prompt and 6 of 6 on the new. Not
  tried in a browser: the sound by ear, the heard list in local storage, a booked event in Google Calendar.
- **Review fixes (`rec/fix`)**: the 5 AM day start, the Safari-safe Done sound, the spoken skip, no in-app heads-up for
  Zeno's blocks, direct rule lines, and four prompt clauses (a slip, a stop, a smaller cut offered, and remember keeps
  "any amount, date or time they gave"). Found while checking: the direct prompt's "Start now?" got copied into tap
  chips (about 1 reply in 9, 0 on main), so a chip loses a trailing "?" (`shortStrings`, `src/lib/agent.ts`).
  Verified: typegen, tsc, eslint (src and scripts), build and every self-check, with asserts that fail on the old code
  (a 12:20 AM pattern named that morning, an 11:40 PM one kept quiet at 12:10 AM, a suspended context playing nothing). The samples file above was re-run on the final prompt (12 moments,
  with a stop and a plan that won't fit): no slip is called a loss, a stop is taken in one line, and a plan that won't
  fit was never cut (rec/build cut it in 1 of 3 runs, main in 1 of 1). A/Bs of 6 runs: the bench's remember + set_goal
  turn main 4, rec/build 4, rec/fix 5 (the plan was saved every time; each miss kept "brain is mush" private, as on
  main); the "$2,000 on my credit card" fact kept its amount main 6, rec/fix 4 before the remember clause and 6 after;
  the update turn in the bench's own state main 5, rec/fix 5. Memory bench runs 3 and 4 (before and after that
  clause): overall 90.6 and 86.1, privacy 96.4 and 100.0, no leaks or false claims, rows deleted. Their misses were the
  kept-private turn (both), a reworded bio lab duplicate (run 3) and the update (run 4). So US0011 AC5 (within 2 points
  of 96.1, a single Nov 2 run) is still unmet (88.6, 98.6, 90.6, 86.1); two same-day runs on `main` would show whether
  that bar was one lucky run.
- **Live test on production** (Nov 3, 3:20-3:45 AM PT, demo account, every audio output stubbed silent, no mic):
  the late-night opening "De, you're still up. Let's wind down and line up tomorrow. Set up tomorrow?"; a typed
  "Set aside 30 minutes tomorrow at 10 AM" got "Ten is taken. Ten fifty is open for thirty. Book it?" (the block
  offered was 10:50-11:20, chips without "?"), and tapping Book made an event that Google Calendar shows with no
  notification line, where a class event that day shows "30 minutes before"; Undo removed it (DELETE 200, gone from
  Google Calendar). With Sound on, a tapped Done scheduled both notes after the save (PATCH 200) and a "Done" chip
  (the spoken path) played it too; Sound is back off. Day 2, with a test pattern dated Nov 1 added to the demo
  account: the app's opening sent `heard: []`, got `noticed: [id]`, said "You do better before noon, so let's set
  up morning." and stored `zeno:heard`; the next opening sent that id, got no `noticed` and no pattern line. The test
  row was deleted and the key cleared. A talk turn with a booking took 10.2 s (two model rounds). Left on the demo
  account until the reset: the "PHIL-134 Thesis Card #2" plan is finished (two steps marked done by this test).
- **Found live and fixed**: after `start_step` the model said a ref aloud ("s2 is open. Write one claim about the
  argument in one sentence. Ready to time ten?") despite the "never say refs" rule. `withoutRefs` (`src/lib/agent.ts`)
  now turns a step ref into its saved title and a memory ref into "that" in talk replies and openings; asserts in
  `agent.check.ts`, one through `talk()` that fails without it.
- **For the video**: turn Sound on for the Done sound. Shot 6 needs a pattern from Nov 3 in Memory; the first opening
  after 5 AM on Nov 4 in that Chrome uses it up (one before 5 AM doesn't), so to take it again delete the
  `zeno:heard:…` key in DevTools > Application > Local Storage (keep `zeno.canvas.…`) and reload.
- **Revert one item**: reminders: put back `overrides: [{ method: "popup", minutes: 10 }]` on timed blocks in `eventFor`
  (and drop `!event.zeno` in `soonEvent` for the in-app heads-up). Tone: restore the persona lines and "one soft
  question" from `git show 7354108:src/lib/ai.ts` and `7354108:src/lib/agent.ts`, and the rule lines from
  `7354108:src/lib/brief.ts`. Sound: delete the two `playDone()` calls and the `wakeAudio()` call in
  `src/components/guided-day.tsx`. Day 2: make `newPattern` in `src/lib/agent.ts` return `null`. Each needs its asserts
  adjusted.

### Nov 4 sprint (on `main` and in production since Nov 3, 1:15 AM PT: `e0e7ac6`)
From Vi's answers on the night of Nov 2 (product brief sections 2 and 8): "I don't want any alarm… It's annoying",
check-ins "even quieter", and "I pause two seconds, just think about what to talk next, and then the voice just
interrupts me… leave space where people think." Built on `nov4/focus` and `nov4/voice`, merged and fitted together here.
- **Focus is a quiet stopwatch**: it counts up from the step's start ("75:03" past an hour) with "planned 15 min" muted
  beside it; no alarm, chime or spoken line, ever. Zeno's lines under the card are muted and never said: "I'll stay
  quiet." at the start, one check-in at the planned minutes times the person's pace ("15 min in. Finish the line you're
  on, then Done.") for that minute only (never late after a laptop slept), then the calm line again however long it
  runs; back on the tab after a minute away (Page Visibility only), "Back. 23 min on this."; a heads-up before an event
  is a quiet line too ("Heads up, CS 146 at 2:00 PM."), never spoken in Focus. None covers a question with answers, a
  draft, the person talking, or Zeno's answer to something said in Focus (the tip after Stuck? stays).
- **Pace is learned from use**: `GET /api/day` returns `pace`, the median real/planned minutes of the last 20 finished,
  timed steps (last 30 days), within 0.75-2; missing below 3 such steps (then 1).
- **Open in Canvas** joins Focus's links when the plan is a Canvas assignment (the title as whole words, the most
  specific title wins, the course breaks ties; a one-word title such as a bare "Quiz" needs its course in the plan).
  **Cheaper opening**: one under 20 minutes old shows again on reload with no model call when the plan (step ids,
  statuses, titles, minutes) and the Canvas list (as this load's sync left it, within 4 s) are the same, no event began
  or ended since, and no talk turn or Memory change happened since.
- **Voice leaves room to think**: a final no longer ends the turn. Zeno waits 0.7 s after a question, a short reply
  ("yes", "done", "what's next") or an answer of three words or fewer that Meta ended as a sentence ("One point.",
  "Set up tomorrow."), and 3 s after anything else, a whole sentence too (`answerSoon`, `src/lib/turn.ts`): Meta reports
  new speech up to 0.9 s late, so a two-second pause needs 3 s. More words join the turn. Tapping Talk, or anywhere else,
  while words are heard sends them at once; with nothing heard it stops. A hidden tab or a dropped relay during the wait
  still sends what was heard, and a turn goes at most 2 minutes after the listen began (a TV in the room).
- Gallery: `/preview?state=` `focus`, `focus-checkin`, `focus-back`, `focus-overtime`, `focus-two-line`, `focus-canvas`.
- **Verified**: typegen, tsc, eslint (src and scripts), build and every self-check (`turn.check.ts` drives the real voice
  hook through the waits, a two-second pause after a whole sentence with Meta's 0.9 s onset lag, done talking, errors
  mid-wait, the 2-minute cap and hands-free). The voice track probed Meta's realtime ASR live with synthetic speech:
  finals are now punctuated, with semantic endpointing. The gallery states were looked at in Chrome at 1456x830 and
  390px wide (fine; the goal line is cut with "…" on a phone so the due part stays whole).
- **Live test on production** (Nov 3, 1:15-1:40 AM PT, demo account, sound muted, no mic): a typed "let's start the
  first step now" opened Focus on "Pick one claim angle" (PHIL 134 Thesis Card #2) with the stopwatch counting up beside
  "planned 5 min" and **Open in Canvas** (new tab, `noopener noreferrer`, the assignment's page); after 61 s hidden
  (simulated `visibilitychange`) the line was "Back. 1 min on this."; at 5:00 the muted check-in "5 min in. Get it to a
  stopping point, then Done." showed (no `pace` yet: fewer than 3 timed steps); Done stamped and offered "Nice. Next:
  Draft one-sentence card, 10 min". Reload 1 asked the model for a new opening (the Done had changed the plan); reload 2
  showed the saved opening with **no** `POST /api/day/opening`. **Voice was not tried** (night): Vi's real-mic test is
  still to do (say a sentence, pause two seconds, go on; tap Talk mid-turn; answer a question hands-free).
- **Known limits**: a reload during Focus lands on the home card, and Start restarts the step's clock (the server rule).
  A command ("Put it on my calendar.") goes about 3.3-3.8 s after the person stops unless they tap Talk; if Vi finds that
  slow, let `answerSoon` take whole sentences again (the trade: cut off after a pause). On Chrome's Web Speech (no
  punctuation) only short replies go soon. Meta can take 1.2-2.6 s to end a bare "Yes.". On a phone the DONE stamp
  briefly covers "planned N min". A reused opening is said again on reload.
- **Vi's calls**: (1) heads-ups in Focus are shown quietly; skipping them there instead is one line in `headsUp`. (2) The
  pace can count twice: once 4+ steps took about 2x, the "Steps take you about 2x as long as you plan." pattern lets Muse
  lengthen the first step, and `pace` (from the older, shorter steps) still doubles the check-in moment, so it lands
  late until newer steps pull the median down. Apply it in one place: drop the step-length hint from the prompts
  (`src/lib/agent.ts`), or skip the pace while that pattern is saved.

### Nov 2 evening: the tidy round (on `main` and in production: `7adcddb`)
Vi connected the real SJSU Canvas on production: "It looks kind of messy… It doesn't have the context. I think it needs
some sort of AI to organize it a little bit." Spec and details: the last section of `docs/PLAN-NOV2.md`.
- **Canvas reads clean at the source**: course codes ("HIST 110", also after a term like "FA 2026" or "AU26"), titles
  without proctoring notes, a title with a password or code kept as its kind ("Quiz"), deadlines saved whole; the next
  sync replaces the old rows. Disconnect deletes the saved Canvas deadlines (`DELETE /api/canvas`) and says so if that
  fails, with Try again; it re-plans the home card, as Connect does when it found work due.
- **Calm rows**: the Canvas screen lists all work due in 2 weeks by day, a title on two lines at most and a time only
  when it isn't 11:59 PM; Memory folds Canvas into "11 Canvas assignments", which opens them there with the usual ×;
  Today's deadlines take two lines at most. On a phone the links under the big button drop their "·".
- **Focus keeps the context** ("<goal> · due <when>" on one line under the step, in the card's old blank row, so the
  title stays on screen) and Sources is one compact card that scrolls clear of the dock but never past the card's top.
  With a plan open, Connect leaves the card on that plan.
- Gallery: `/preview?state=` `focus-canvas`, `focus-sources`, `canvas-connected`, `memory-canvas`, `desk-deadlines`.
  Typegen, tsc, eslint, build and every self-check pass, and `DELETE /api/canvas` worked on a local production build
  for a throwaway @zeno.local user; not tried in a browser or with a real Canvas yet.

### Live test on production (Nov 2 evening, demo account, reset first)
Verified in Chrome: the screens in `/preview` at 1512x806 and 390 px wide (light and dark), then on production as a new
user: first sign-in ("Reading your calendar and email…", then "I read your calendar and email and learned 13 things,
including 4 deadlines.", [Start my day]) → the card ("Open lab instructions · 5 min · Finish BIO 101 lab report · due
Friday", [Start · 5 min]) → Focus (Sources found a LibreTexts page; Music plays lo-fi from the app and piano from
archive.org) → Done ("Nice. Next: List data to include, 15 min", streak row) → That's enough today (no block: 55 min
left, under the 60-minute rule) → Back to my day (the next step's card). Talk: "put the lab report on my calendar"
offered one block, booked as "Finish BIO 101 lab report" with Undo; a Gmail draft opened compose with a subject and
body. The Memory list after the scan was tidy (one routines sum-up, dated deadlines, a generic "Has a doctor check-in
on November 3." on the device only). The Week fits 9 AM-9 PM without scrolling and opens events in Google. The memory
bench on the new code scored 96.1 overall and 96.9 privacy (no duplicates, no junk, no leaks).

Fixed during the test (all on `main`):
- **First sign-in found nothing**: the scan's model call needs ~9-13 s and each try had 12 s; it now gets 30 s tries
  inside 45 s (the route allows 60), the card waits up to 50 s, and a failed first scan is retried on the next open
  (it used to mark the day as scanned before running).
- **Dead ends**: Back to my day showed a vague "Let's start"; a booking or a draft in talk left no button. Every way
  out now lands on the home card with its Start; a booking says "Booked. …" with Back to my day, Undo says "Okay, it's
  off your calendar." with No thanks.
- **One name per task**: a block for the whole goal took the model's words ("Work on lab report"); `propose_block` takes
  ref "goal" and then the goal's saved title.
- **Pasted notes saved each dated item twice** ("To do: Write final reflection paper" and "COMM 20 final reflection
  paper, due …"); a to-do a deadline covers is dropped.
- The card's goal line wrapped around "15 min"; the music picker didn't show which station was on.

### What changed on nov2/integrate
- **One card, one big button.** Every other action is a small link under it. Header: the Z mark, the streak and the
  avatar (its menu: Sound, Canvas, Privacy, Sign out). Dock: Talk over Type · Today · Memory. No stage tracker and no
  plan screen: Card [Start · N min] → Focus [Done]; Stuck? · Stop for now · Sources (or Draft it in Gmail) → Done
  ("Nice. Next: …" [Keep going]; That's enough today) → Wrap ("Saved. I'll bring it back next time.").
- **Calendar writes only when asked or for 60+ minutes.** Talk refuses smaller blocks; Stop for now offers one block
  tomorrow only when the plan's open steps add up to an hour. Pasted notes only save memories. The Week is read-only,
  fits the day and opens each event in Google Calendar (on Sunday it shows the coming week).
- **No quiet lines.** Memories save silently; heads-ups are only spoken.
- **Memory.** The card and any block use the step's saved title. Rewordings merge on save, the scan keeps no class or
  shift facts, undated "To do:" memories expire after 14 days and clear when their plan finishes, and patterns read
  "Works best in the morning." The Add box also takes pasted notes (a line break or over 200 characters).
- **First sign-in asks nothing:** "Reading your calendar and email…", then one line of what it found, [Start my day]
  and Paste notes · See what I learned.
- **Mail.** The inbox shows only people and school, one line each, with "Open Gmail". Zeno drafts an email in the
  person's Gmail compose window and never sends one.
- **Canvas.** A personal access token kept only in the browser (`zeno.canvas.<account>`, cleared at sign out).
  `POST /api/canvas` reads 14 days of unsubmitted work, saves the deadlines as memories (source "canvas") and returns
  the 3 soonest instructions, which ride with the opening, talk and prep as `canvas` and are never saved.
- **Health stays generic**, even in the browser vault: a condition's or medicine's name is never kept.

### How it was verified
- On `nov2/integrate`: typegen, tsc, eslint (src and scripts), build, 17 self-checks (new: `canvas.check.ts`,
  `gmail.check.ts`) and listen-check; day-flow and week-grid also in LA and Tokyo time.
- Brain's live smoke test against Muse (made-up data): one name per task, a draft to an inbox sender, no block unless
  asked, and "write my essay" refused with an offer to plan it.
- The browser, first sign-in, Gmail compose, the Week and the memory bench were verified afterwards, live (above).
  Still not verified: Canvas with a real token, and voice (the mic) in this round.

### Review fixes on nov2/fix
- **Memory saves**: what the person says is dropped only when known word for word (a reworded scan finding still
  merges); a longer wording takes a row only in the same group and of the same kind (fact, to-do or deadline), so a
  to-do never rewrites a People fact or a Canvas deadline; a finished plan clears only the to-dos its title says all of.
- **Calendar asks**: "put it on my calendar", "block 30 minutes", "make time for it" count, "what's on my calendar?" and
  "the book's chapter" don't, looking back two of their messages; an unasked block on a step needs an hour left in its
  plan. Without calendar write access, the account menu shows "Let Zeno add to your calendar" and talk points there.
- **One name per task** for Stop for now's block too (the step's title). Pasted notes keep at most one routines fact.
- **Privacy**: a condition's name already in the browser vault, or in its removed list, is deleted on load and
  dropped by every route; the saved day keeps no Gmail link (it holds the address); Canvas instructions lose links and
  sentences with codes; a page-load Canvas sync can't undo Disconnect or Sign out; the token field is no longer a
  password field; the privacy page says what this browser keeps.

### Known issues
- **Talk and Stop-for-now offers can sit right after another block** (no gap after it).
- **Near-duplicate facts** whose date words differ ("Lab report 3, due Friday" and "Owes BIO lab report 3 due
  November 6"). Rewordings with the same date words now merge.
- **Old rows stay**: "To do:" memories saved before Nov 2 never expire, and class and shift facts already scanned stay
  until removed or the demo reset.
- **A fallback card can disagree on minutes**: the rule pick shows 5 minutes for a long step where the model pick shows
  the saved minutes (the title always matches).
- **Coursework naming a condition** ("PSYCH 1: Quiz 3: Anxiety Disorders", a nursing "Diabetes care plan") is kept
  nowhere, not even as a Canvas deadline. The Great Depression, search and seizure and civil disorder are no longer
  caught. Letting coursework through needs Vi's call: plan titles come from it and are refused with a condition's name.
- **Canvas:** only `<school>.instructure.com` addresses; a slow Canvas can pass the route's 30 s. A course name without
  a code, or one written "2026FA_CS_146_07" or "cs 146", shows as its first 28 characters; a two-word department
  ("COMP SCI 300") shows as "SCI 300". A Canvas deadline forgotten in Memory on production before the tidy round was
  saved with the raw course name, so the first sync after it saves the clean one again; forgetting it once more holds.
  The Canvas screen's list, kept in the browser, can hold a course title that names a condition ("Quiz 3: Anxiety
  Disorders"); hiding it would hide real work, so that is Vi's call. With a plan open, Connect doesn't move the card to
  a sooner Canvas deadline (one plan at a time; Vi's call). A Canvas row or Today deadline past two lines is cut, whole
  only on hover.
- **Week:** a one-hour event's title is cut on a laptop ("CS 146 Data…"); hover or keyboard focus shows it whole, and on
  touch only Google Calendar does. On a short window the 28px minimum row can leave about 15px of scroll.
- **Demo inbox**: Maya's 8 emails are self-sent, so every sender reads "De Bruyne" and a draft to Prof Patel has no To
  address (Zeno never guesses one).
- **The cached card shows at once, its Start about 3 s later** (when the fresh day answers).
- From session 3, still open: the greeting uses the Google first name ("Hi De"); the mail filter is broad; reload
  shows the saved line for 2.5-4 s; scanned facts and patterns stop saving at about 120 facts in the person's own
  words. (The access token is no longer in `/api/auth/session`: `withoutAccessToken` in the auth route strips it, with
  `session-json.check.ts`.)

### Product spec (SDLC Studio, drafts for Vi, merged Nov 3)
`sdlc-studio/prd.md` (Vi's 40 answers from the night of Nov 2, which win over older plans), personas in
`sdlc-studio/personas/` (Maya Torres is the demo persona), 16 epics in `sdlc-studio/epics/_index.md` (Nov 4: EP0001
quiet focus, EP0002 voice, EP0004 demo readiness; EP0003 cheaper opening was moved to Later by the spec review, but it
already shipped), the Nov 4 stories US0001-US0017, and the video plan `docs/DEMO-NOV4.md` (8 shots, the Nov 3 timeline,
the 2 PM reset cut-off). Everything is Draft until Vi approves; "yes to the defaults" answers the open questions
(PRD §11 group A: OQ-1 to OQ-8, OQ-19, OQ-20; DEMO's DQ-1 to DQ-5).

**Spec vs built** (the stories were written before the Nov 4 sprint shipped; reconcile their status after Vi approves):
- US0001 stopwatch, US0002 Focus silent, US0005 "Back." line, US0006 waits through a thinking pause, US0007 done
  talking: built in `e0e7ac6`. Differences: Done talking is a tap on Talk (or anywhere) while words are heard, not a
  "Done talking" link; whole sentences wait 3 s too (Meta's onset lag), questions and short replies 0.7 s.
- US0003 (Muse writes a check-in minute per step into a new `steps.checkin` column): **not built**. The check-in is at
  the step's planned minutes (written by Muse) times the person's learned pace.
- US0004 the check-in line: built, but under the card in the caption slot; the revised story puts it on the card in
  the goal line's place (OQ-19, Vi's call).
- US0008/US0009 cheaper opening: built client-side instead (`openingSig`/`openingReusable` in `day-flow.ts`: reuse a
  saved opening under 20 minutes old when the plan, Canvas list and timed events are unchanged), not as a server key.
- US0010-US0013: built and live-tested (`32cef15`, VI-353, section 0 "Before recording"); Vi still approves the tone
  (`docs/TONE-SAMPLES-NOV3.md`, US0011 AC4) and the sound (US0012 AC5). US0011 AC5 (memory bench within 2 points of
  96.1) is unmet: 88.6, 98.6, 90.6, 86.1, with misses that A/B the same on the old prompt. US0013 announces a pattern
  learned before the person's today (which starts at 5 AM) and within 7 days, in the first opening of a later day, so a
  day-1 pattern is said on day 2 (the story's own window would spend it on day 1).
- US0014 (Vi: rename the demo account to Maya, a Prof. Patel email from a demo-only mailbox), US0015 release check and
  freeze, US0016 reset at Vi's go by 2 PM Nov 3, US0017 live check before the Nov 9 final: not started.

### Next steps (Nov 3)
Every open decision with its default, Vi's checklist and the risks are on one page, private to Vi:
https://app.superset.sh/page/zeno-nov-3-brief-gf2zpp (source `.claude/pages/zeno-nov3-brief.html` in the main checkout,
not in git; republish that path to version it).
1. Vi, morning: approve the PRD and Nov 4 epics or say what to change; rename the demo Google account to Maya; sign out
   of Zeno and in again (sign-out clears the device's Canvas link) and re-link Canvas with a **new** token (revoke the
   one pasted in chat on Nov 2); the 2-minute voice test; read `docs/TONE-SAMPLES-NOV3.md` and hear the Done sound
   (VI-353: the demo plan is finished, so ask Zeno for a small plan, Start it and tap Done with Sound on).
2. Claude, at Vi's go and by 2 PM: the release check (US0015), then the demo reset (VI-326/US0016: the demo account's
   rows with `demo-rows.mjs --wipe`, which also proves no other account changed; Zeno's calendar blocks; the `zeno*`
   browser keys except `zeno.canvas.<account>` and `zeno:sound`). Then Vi records shot 3 right away by reloading Zeno
   (not Sign out, which would clear Canvas), then shots 4-5.
3. Vi, 2-10 PM: use Zeno for real on the demo account (5+ finished steps, most in one part of the day). Nov 4 morning,
   no reset: shot 6 first, before anything else opens the demo account. Submit before 6 PM PT.

## 0a. Session 3 (2026-11-01): the follow-through build and the live test

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

### Known issues (as of Nov 1; section 0 has the current list)
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
- Persona **warm, candid friend**: short, offers instead of orders, one question at a time, honest when a plan will not fit. ("Sounds like a dictator" meant both the bossy prompt and the dictation-style voice flow.) Replaced on `rec/build` by the direct tone Vi chose on Nov 3 (section 0, "Before recording").
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

`nov2/integrate` (the Nov 2 round, all four tracks) and `nov2/music` (focus music) wait to be merged into `main`;
see section 0. Everything through 341dd7a is on `main`. Workflow worktrees under `.claude/worktrees/` and old local branches (`feat/*`, `integrate/*`, `design/finish`, `fix/foundation`) can be deleted.

## 6. Remaining work

See "Next steps" in section 0, the Linear issues VI-306 to VI-318, and `docs/SUBMISSION.md`. Deferred past Nov 4 (record as unmet, per C09): journal, undo, drag planner, travel-aware conflicts, overfull-day tradeoffs, durable background work, email sending, Productive News, scheduled reflection, MCP, team mode, native apps.

## 7. How to work in this repo

- Fresh checkout: `npm ci`, then `npx next typegen` (otherwise tsc fails on `LayoutProps`). If tsc complains about deleted routes, delete `.next/dev` (stale generated types).
- Checks before any merge: `npx tsc --noEmit --incremental false`, `npx eslint src/`, `npx next build`, every `src/**/*.check.ts` (plain `node`), `node scripts/listen-check.mjs`.
- Next 16 with `cacheComponents: true`: never export `runtime`, `dynamic`, `revalidate`, `fetchCache` or `dynamicParams` from a route; `maxDuration` is fine.
- The React Compiler lint now checks `GuidedDay`: a function used above its declaration inside a `useEffectEvent` fails lint.
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
