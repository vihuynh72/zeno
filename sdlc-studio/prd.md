# Product Requirements Document

**Project:** Zeno
**Version:** 0.1
**Last Updated:** 2026-11-02 (the night of Nov 2-3)
**Status:** Draft, awaiting Vi's approval

**Source of truth:** Vi's 40 answers from the night of Nov 2-3 (the product brief). Where this PRD and an older doc
(`docs/PLAN-NOV2.md`, `docs/PLAN-NOV.md`, `docs/SUBMISSION.md`) disagree, the brief wins. Section 11 lists what is
still open.

**Labels used on every feature:**

- **Live**: on `main` and in production today (commit `e716f09`, Nov 2).
- **Nov 4**: ships before the demo video (Nov 4, 6 PM PT; production stable that morning).
- **Later**: after Nov 4.

**How it is used:** Vi approves this PRD, then each epic. Claude runs the sprints (build, test, review, ship) and
reports. A change after approval goes through a change request (`sdlc-studio/change-requests/`).

---

## At a glance

- **What Zeno is:** "It runs my work for me." Zeno gathers what you owe, plans it, schedules it, stays with you while
  you do it, and learns. Your only job is the next small step.
- **Mission (recommended):** "Other AI does your work. Zeno gets you to do it." Tagline: "From 'I should' to 'I did.'"
- **Who it is for:** anyone with work to do. Designed first for a college student who knows what to do but can't
  start, often with ADHD: Zeno is "for brains that know what to do but can't start".
- **What Nov 4 adds:** a stopwatch instead of a countdown, one quiet check-in per step, a "Back." greeting when you
  return, and voice that waits while you think.
- **First big project after Nov 4:** Plan mode, a workspace for goals and projects that Zeno keeps current.
- **Success at two weeks:** steps finished per day, deadlines met, back on most days, less stress.
- **For Vi now:** 8 questions to answer before Nov 4 (section 11, group A). Each has a default, so "yes to the
  defaults" is a full answer.
- **What to read:** this page, then "Product principles", "What Zeno is NOT" and "The quiet way to manage long-term
  goals and projects". Sections 3-10 are the detail for building.

---

## 1. Project Overview

### Product Name

Zeno.

### Purpose

**Vision.** Zeno runs your work for you. It reads what you owe from Canvas, your calendar and your email. It picks
what matters, makes it small enough to start, puts the big things on your calendar, and stays with you while you do
it. It learns how you work from what you do, never from a questionnaire. You never manage a list. In Vi's words:
"an agent that manages everything so they never have to manage. Before they get into working, all the steps are
cleared out for them so they can just do something step by step."

Long term, Zeno is the quiet layer between all your tools and your day: on your laptop, on your phone's lock screen
and in your Mac's menu bar, it always shows one thing.

**Mission: three options (final wording is Vi's call, OQ-1).** Vi wants the mission AI-native and tied to Meta's Muse
and the AI age.

| Option | Wording | Strength |
| --- | --- | --- |
| A. The AI-age flip (**recommended**) | "Other AI does your work. Zeno gets you to do it: it finds what matters, makes it small enough to start, and stays with you until it's done." | Says what is new in one breath. Judges see at once why Zeno is not another chat app. |
| B. Chief of staff | "A chief of staff for your work: Zeno runs it, so your only job is the next step." (draft wording) | Familiar and warm. Less tied to the AI age. |
| C. The paradox story | "Zeno's paradox says you never arrive: there is always half the way left. Zeno's answer: small steps add up, and you do arrive." | Explains the name. Best as a story, too long as a line. |

**Recommendation:** use A as the mission line, "From 'I should' to 'I did.'" as the tagline, and C as the optional
ten-second opener of the video and the "why the name" story. B's idea lives on in the promise ("It runs my work for
me").

**The first small step is the heart.** Vi: "The feature of having Zeno identify the first small step is just amazing
for me."

### Tech Stack

- Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript, Tailwind CSS 4.
- Auth.js (`next-auth` 5 beta) with Google sign-in.
- Neon Postgres through the serverless driver.
- Vercel (Fluid compute) hosts the app; `main` deploys to production at https://zeno-sigma-topaz.vercel.app.
- Meta's Muse: Muse Spark 1.3 (the brain) and Muse Voice Transcribe 1.0 (realtime speech to text).
- Google Cloud Text-to-Speech (Chirp 3 HD "Achernar") for Zeno's voice, because Meta has no text-to-speech.
- Google Calendar and Gmail APIs; the Canvas REST API.

### Architecture Pattern

One Next.js app. The screens (`src/components/guided-day.tsx` runs the flow; `day-view.tsx` draws it) call JSON
routes under `src/app/api/*`. The routes use small libraries in `src/lib/` (the agent, calendar, Gmail, Canvas,
goals, memory, patterns). The first card paints from a cache in the browser, so it feels instant; the model's line
arrives a moment later from its own route. Private facts never reach the server's database: they live in a vault in
the browser. Voice streams to Meta through a WebSocket relay route, so the key never reaches the browser.

---

## 2. Problem Statement

### Problem Being Solved

AI now does work for people (or says it does). But with AI everywhere, it got harder, not easier, to see your goals,
see the road ahead and know what to do next. AI is overwhelming. Work lives in Canvas, three inboxes and a full
calendar, and each one shows everything at once. (Vi, after connecting a real Canvas on Nov 2: it "needs some sort
of AI to organize it".)

The hard part is not knowing what to do. It is starting, staying with it, and keeping long-term goals moving while the
week fills up. Chat apps wait for a prompt, never touch your real day, leave once the plan exists, and never learn
whether you did it. To-do and project apps turn your life into a second job of managing lists.

### Target Users

"Anyone with work to do": students and professionals. People with ADHD are a key audience. The cast (in
`sdlc-studio/personas/`):

| Persona | Cast role | Why they are here |
| --- | --- | --- |
| Maya Torres | Primary | A college junior with ADHD and five courses. The design is judged against her. She is the demo persona. |
| Daniel Okafor | Secondary | A busy product manager whose work is spread across six tools. Needs more sources and protected deep work. |
| Rosa Delgado | Secondary | A parent finishing a degree at night. Needs long-term goals, life commitments and the quietest possible footprint. |
| Tyler Brooks | Negative | Wants AI to do his work. Zeno is not built for him. |

### The jobs people hire Zeno for

1. **"Tell me the one thing to do now, and why."** When there is too much and everything looks urgent.
2. **"Make it small enough to start."** When the work is big and the page is blank.
3. **"Stay with me while I do it, quietly."** No alarms, no pings, no questions every ten minutes.
4. **"Make finishing feel good, and have the next step ready."**
5. **"Keep track of everything I owe, so I don't have to."** Across Canvas, email and the calendar.
6. **"Keep my long-term goals moving without me managing them."** Projects, a degree, the gym.
7. **"When I slip, re-plan without guilt."**

### Context

- **Hackathon:** Meta Global AI Developer Hackathon, Indie Developer track. Judging: Impact 30%, use of Meta AI 25%,
  technical depth 20%, demo 25%. Deadline: Nov 4, 6:00 PM PT. Production must be stable by the morning of Nov 4. Keep
  Meta's Muse at the core.
- **Earlier decisions that stand** (from `docs/PLAN-NOV2.md`): one card and one big button; Card → Focus → Done; no
  quiet lines; the calendar only for big things; an important-only inbox; Gmail drafts; Canvas through a token kept on
  the device; health facts kept generic; focus music.
- **What the brief changed** (the brief wins): the countdown becomes a stopwatch; spoken check-ins become one visual
  check-in; the default voice goes from "warm, candid friend" to direct; Zeno may later write to the main calendar in
  a distinct color instead of a separate "Zeno" calendar; subject help may suggest an outline or a first sentence (the
  person writes it); Plan mode may let people drag to schedule (the Do mode Week stays read-only).

---

## Outcomes

- **O1:** Every day, people finish small steps on the work that matters. (Maya Torres, End goal 1)
- **O2:** People meet their deadlines without last-minute crunches. (Maya Torres, End goal 2)
- **O3:** People come back on most days because Zeno helps, not because it nags. (Maya Torres, End goal 3)
- **O4:** People feel less stress about their work. (Maya Torres, End goal 4)

### Success metrics (measured two weeks after a person starts)

The four measures are Vi's. The target numbers are proposals until Vi sets them (OQ-15).

| Outcome | What we measure | How | Proposed target | Can we measure it today? |
| --- | --- | --- | --- | --- |
| O1 Steps finished per day | Finished steps per active day, per person (median) | `steps.done_at`, counted in the person's time zone; an active day is a day they opened Zeno | 2 or more | Partly: finished steps yes; "opened Zeno" is not recorded yet |
| O2 Deadlines met | Share of known deadlines whose work was done by the due date | A Zeno goal with a due date and all steps done by then; a Canvas item marked submitted before its due time | 85% or more | Partly: goals with due dates yes; Canvas "submitted" is Later (B5) |
| O3 Back on most days | Share of people who open Zeno on 8 or more of their first 14 days | A once-a-day "opened" mark per account (no tracking outside Zeno) | 50% or more | No: needs the daily mark |
| O4 Less stress | Change in a 1-5 "How stressed are you about your work?" rating, day 1 vs day 14 | Asking conflicts with "learn from use, never ask" (OQ-16) | A drop of 1 point or more | No |

---

## Product principles

1. **One card, one big button.** Every screen shows one thing and one big button for the yes. Everything else is a
   small link under it. Taps act at once; Zeno's words follow. (Vi: "simple, not overwhelming".)
2. **Zeno does the managing.** People never have to type, sort or arrange. Zeno proposes; one tap confirms. They can
   edit, but never have to: "They can just tell Zeno." Zeno learns from what people do, never by asking questions
   about them.
3. **Quiet by default.** No alarms, no check-in sounds, no notifications for check-ins, calendar events or missed work.
   About one nudge a day at most, unless something is critical (due today, an exam tomorrow) or about a long-term
   goal. "Normally I don't want to have it nudging you constantly."
4. **No surveillance.** No screen recording, no app tracking, no idle-detection permission. Zeno knows only whether
   its own tab is showing.
5. **Trust rules.** Zeno never does the work wholesale. It never sends mail without you. It never keeps private data
   on its servers: private facts stay on your device, and passwords and codes are never kept anywhere. It acts on small
   things (re-plan, reorder, rename, capture) and asks before big ones (main calendar events, emails, anything other
   people see). Tone settings never change these rules.

## What Zeno is NOT

- **Not an app to record stuff.** Notes go in so Zeno can act on them, not to build an archive.
- **Not a general chat wrapper, harness or general agent.** Vi: "I don't want to make it like a general chat wrapper
  or a general harness or general agent, I want it to be a really proactive agent."
- **Not general project-management or goal software.** No setup, no fields to fill, no boards to keep tidy. Plan mode
  exists, but Zeno keeps it current.
- **Not an AI that does your work.** No essays, no answers, no submissions. It may suggest an outline or a first
  sentence; you write. ("Write my essay" gets a plan and a first step instead.)
- **Not a nag.** No alarms, no pings to check in every 5-10 minutes, no reminders on Zeno's calendar events.
- **Not a watcher.** It never sees other apps or tabs.
- **Not a place for private data.** Private facts stay on your device.
- **Not a calendar app.** It writes into your own Google Calendar; it does not replace it.

## The quiet way to manage long-term goals and projects

Vi asked how people can manage their projects, their life and their really long-term goals with something that
doesn't make them change their life, "just be a quiet part in their life". The brief's answer, in one place:

1. **People talk; Zeno structures.** They say "I want to finish my degree by 2028" or "gym three times a week", or Zeno
   notices it in Canvas, the calendar or email. Zeno proposes the goal, its projects and today's step. One tap
   confirms. (C2, C3)
2. **Every item has a kind, so Zeno's choices make sense.** Deadline, Commitment, Step or Nice-to-have, shown as a
   label. (C4)
3. **A long-term goal shows up only as today's step, when it is its turn.** The home stays one card. Goals live inside
   the Today sheet, not on a new screen. (A1, C5, D2)
4. **One ritual a week, one line long.** Sunday evening: "3 goals moving, 1 slipping. Plan the week?" One tap gets a
   drafted week. (C6)
5. **Slips are handled quietly.** Deadlines and commitments move to the next good slot; nice-to-haves slide. Only
   something at risk, or slid twice, gets one question the next time they open Zeno: [Tomorrow] [Let it go]. (E1)
6. **The big picture is there when they want it.** Plan mode shows every goal and project, but nobody has to keep it
   tidy: Zeno does. (F1-F5)

---

## 3. Feature Inventory

"Built today" uses the skill's status words: Complete, Partial, Not Started.

| ID | Feature | Ships | Built today | Where in the code |
| --- | --- | --- | --- | --- |
| A1 | One card, one big button; small links under it | Live | Complete | `src/components/guided-day.tsx`, `day-view.tsx` |
| A2 | Card → Focus → Done, with Stuck?, Stop for now, That's enough today | Live | Complete | `src/components/day-flow.ts` |
| A3 | Focus stopwatch: counts up, planned time shown softly, no alarm | Nov 4 | Not Started (a countdown today) | `day-view.tsx` (`Countdown`) |
| A4 | One quiet check-in per step: a soft line at a moment Muse picks | Nov 4 | Not Started (spoken start, halfway and end lines today) | `guided-day.tsx`, `day-flow.ts` (`CHECKINS`) |
| A5 | Return greeting: "Back. 23 min on 'Outline claim 2'." | Nov 4 | Not Started | `guided-day.tsx` |
| A6 | Check-in moment learned per person over time | Later | Not Started | - |
| A7 | Focus music, sources for the step, Draft it in Gmail | Live | Complete | `focus-music.tsx`, `src/lib/prep.ts`, `gmail.ts` |
| B1 | One-tap Done; saying "finished the outline" also counts | Live | Complete | `guided-day.tsx`, `src/lib/agent.ts` (`finish_step`) |
| B2 | Done is rewarding: the DONE stamp and the next step ready | Live | Complete | `day-view.tsx` |
| B3 | A small sound with the stamp | Nov 4 or Later (OQ-3) | Not Started | - |
| B4 | The goal's progress bar moves on Done | Later | Partial (Today's plan strip) | `desk.tsx` |
| B5 | Done from the source: Canvas "submitted", a sent Gmail; later Docs and GitHub | Later | Not Started | - |
| B6 | One 5-second "did these get done?" list at the person's daily moment | Later | Not Started | - |
| B7 | Done from the lock screen, widgets and watch | Later | Not Started | - |
| C1 | One current goal with short steps; Muse sets each step's minutes; plans change by talking | Live | Complete | `src/lib/goals.ts`, `agent.ts` |
| C2 | Goals (long-term, incl. life goals) → Projects (weeks) → Steps (today) | Later | Not Started | - |
| C3 | Zeno proposes goals and projects from talk, Canvas, calendar and email; one tap confirms | Later | Partial (the first card plans the nearest deadline) | `agent.ts` (opening pick) |
| C4 | Item kinds as labels: Deadline, Commitment, Step, Nice-to-have | Later | Not Started | - |
| C5 | Goals inside the Today sheet | Later | Partial (Today shows the current plan) | `desk.tsx` |
| C6 | Sunday evening check-up with a one-tap drafted week | Later | Not Started | - |
| D1 | First card: the most urgent thing, with a short why | Live | Complete (the why is not on the card) | `agent.ts`, `src/lib/brief.ts` |
| D2 | Full "what matters" weighing, with one line of why | Later | Partial | - |
| E1 | Missed-work triage, with at most one inline question a day | Later | Not Started | - |
| F1 | Do · Plan toggle; Do stays the home | Later | Not Started | - |
| F2 | Project cloud (left): goals and projects with their context | Later | Not Started | - |
| F3 | Flexible center stage: board, goal workspace, calendar | Later | Not Started | - |
| F4 | Zeno panel (right): one-tap suggestions, scoped chat, Muse model picker | Later | Not Started | - |
| F5 | Subject help and a scratchpad per project | Later | Partial (sources for a step) | `prep.ts` |
| G1 | Reads all calendars; a read-only Week that opens Google | Live | Complete | `src/lib/calendar.ts`, `week-grid.tsx` |
| G2 | Writes only when asked or for 60+ minutes; one tap; Undo; a separate "Zeno" calendar | Live | Complete | `calendar.ts`, `booking-chip.tsx` |
| G3 | Main calendar, Zeno's events in a distinct color, after re-consent | Later | Not Started | `src/auth.ts` (scopes) |
| G4 | Title tags [Suggested] [Moved] [Delayed] [Postponed]; reminders off | Later (reminders: OQ-4) | Not Started (blocks carry a 10-minute popup) | `calendar.ts` (`eventFor`) |
| G5 | Muse decides what is calendar-worthy | Later | Partial (a rule: asked, or 60+ minutes) | `agent.ts` |
| G6 | Exam prep: study time reserved or suggested, quietly | Later | Not Started | - |
| H1 | Talk, type, paste notes | Live | Complete | `guided-day.tsx`, `src/app/api/import` |
| H2 | First sign-in scan, then the card; a quiet daily re-scan | Live | Complete | `src/lib/profile.ts`, `src/app/api/profile/scan` |
| H3 | Important-only inbox; Gmail drafts, never sent by Zeno | Live | Complete | `gmail.ts`, `desk.tsx` |
| H4 | Canvas with a token kept on the device | Live | Complete (real-token test still open, VI-324) | `src/lib/canvas.ts`, `canvas-store.ts` |
| H5 | Canvas everything | Later | Not Started | - |
| H6 | Capture anything: forward, share, photo, a big master plan | Later | Partial (paste) | - |
| H7 | More sources: Outlook / Microsoft 365, Notion / Todoist, GitHub / Linear / Jira, Slack | Later | Not Started | - |
| H8 | Zeno as an MCP client | Later | Not Started | - |
| I1 | Forgiving streak | Live | Complete | `src/lib/progress.ts`, `streak-row.tsx` |
| I2 | Patterns learned from use shape the plan | Live | Complete | `src/lib/patterns.ts` |
| I3 | End-of-day recap | Later | Not Started | - |
| I4 | Direct by default; blunt, never cruel | Nov 4 or Later (OQ-2) | Not Started ("warm, candid friend" today) | `src/lib/ai.ts` (persona prompt) |
| I5 | Tone setting: Gentle / Direct / Drill sergeant | Later | Not Started | - |
| J1 | Talk with Muse Voice Transcribe; Zeno speaks | Live | Complete | `src/lib/listen*.ts`, `use-voice.ts`, `tts.ts` |
| J2 | Turn-taking: waits while you think, quick on a complete question, a tap for "done talking" | Nov 4 | Not Started | `listen.ts`, `use-voice.ts` |
| J3 | Try other realtime voice providers | Later | Not Started | - |
| K1 | Web app in laptop and phone browsers | Live | Complete | `src/app` |
| K2 | Installable PWA | Later (first) | Not Started | - |
| K3 | SwiftUI iPhone app: Live Activity stopwatch with Done, widgets, Siri | Later | Not Started | - |
| K4 | Mac menu-bar companion | Later | Not Started | - |
| K5 | API-first server for web and native | Later | Partial (JSON routes, cookie sessions) | `src/app/api` |
| L1 | Private facts on the device; never-keep list; generic health; Memory visible and deletable | Live | Complete | `src/lib/vault.ts`, `profile.ts`, `memory-sheet.tsx` |
| L2 | No surveillance: only Zeno's own tab | Nov 4 (with A5) | Not Started | `guided-day.tsx` |
| L3 | Acts on small things, asks before big ones | Live | Partial (every calendar write takes a tap) | `agent.ts` |

### Feature Details

#### A. Do mode and focus

**User story:** As Maya Torres, I want Zeno to hand me one small step and stay with me quietly while I do it, so that I
start and keep going without alarms or questions.

**Serves:** Maya Torres, Rosa Delgado, Daniel Okafor

**What Vi said:** "I don't want any alarm… It's annoying." Check-ins depend on the task, and Zeno has "got to learn from
the user over time". "I don't want people having to write something or checking in every 5-10 minutes… I want to help
people think better and focus more." Vi chose check-ins that are "even quieter": visual only.

**Acceptance Criteria:**

- [ ] [Live] Home is one card (the step's title, its minutes, one meta line: goal · due) with one big button
      "Start · N min". Every other action is a small link under it.
- [ ] [Live] Card → Focus → Done. Focus has [Done] and the links Stuck? · Stop for now (plus Draft it in Gmail for an
      email step). Done says "Nice. Next: <step>, N min" with [Keep going] and "That's enough today". Every way out
      lands on the home card with its Start.
- [ ] [Nov 4] Focus shows a stopwatch counting up from the step's start (for example 7:12), with the planned time in
      grey beside it (for example "of 25 min"). Muse sets the planned time, as it does today.
- [ ] [Nov 4] When the planned time passes, nothing happens: no alarm, no sound, no spoken line, no color change. The
      stopwatch keeps counting (31:12).
- [ ] [Nov 4] A reload shows the same running time, because it counts from the step's saved start.
- [ ] [Nov 4] Each step has one check-in moment (minutes after the start), picked by Muse for that task, for example
      minute 20 of a 25-minute writing step.
- [ ] [Nov 4] At that moment a soft line appears on the card (for example "Still with the outline? Keep going."). No
      sound, no voice, no notification, no button. It never needs an answer; ignoring it changes nothing.
- [ ] [Nov 4] The spoken start, halfway and end lines go away. During focus Zeno says nothing out loud (spoken
      heads-ups before events: OQ-6).
- [ ] [Nov 4] When the person comes back to Zeno's tab after being away (how long: OQ-7, default 1 minute), the card
      reads "Back. 23 min on 'Outline claim 2'." Zeno knows only that its own tab was hidden and shown again.
- [ ] [Later] The check-in moment adapts to each person over time (what it learns from: OQ-12).
- [ ] [Live] Music (open-license lo-fi and piano, or brown noise made in the browser) plays only while focusing.
      Sources finds 2-3 links for the step. An email step opens a Gmail draft.

**Dependencies:** C1 (steps with minutes). A4's check-in moment is decided with the plan.
**Status:** Partial
**Confidence:** [HIGH] decided by Vi; [MEDIUM] for the check-in copy and the away threshold

#### B. Knowing work is done

**User story:** As Maya Torres, I want finishing to take one tap (or nothing, when Canvas already shows it), so that
Zeno always knows where I am and coming back feels good.

**Serves:** Maya Torres, Daniel Okafor, Rosa Delgado

**What Vi said:** "I want to make sure there's a way for users to keep coming back to Zeno… whenever they complete a
part of a task. We don't want to nudge them all the time." (All four ways below were Claude's proposal; Vi accepted
them.)

**Acceptance Criteria:**

- [ ] [Live] One tap on Done finishes the step. Saying "finished the outline" in talk also finishes it.
- [ ] [Live] Done shows the DONE stamp and the next step, ready to start.
- [ ] [Nov 4 or Later, OQ-3] A small sound plays with the stamp when Sound is on.
- [ ] [Later] The goal's progress bar moves on Done.
- [ ] [Later] Done from the source: Canvas shows the item "submitted", or a sent Gmail reached the right person, and
      the step or goal is marked done with no tap. Later still: Google Docs and GitHub progress.
- [ ] [Later] Once a day, at the person's daily moment (OQ-13), a 5-second list asks "Did these get done?" with one
      tap per item.
- [ ] [Later] Done from the iPhone lock screen, widgets and the watch (with K3).

**Dependencies:** H4 and H5 for Canvas status; H3 for Gmail; K3 for the lock screen.
**Status:** Partial
**Confidence:** [HIGH]

#### C. Goals, projects and steps

**User story:** As Rosa Delgado, I want to say my long-term goal once and have Zeno turn it into this week's projects
and today's step, so that it keeps moving without me managing a planner.

**Serves:** Rosa Delgado, Maya Torres, Daniel Okafor

**What Vi said:** The person can edit, but the UX should mean they never have to type or arrange things: "They can just
tell Zeno."

**Acceptance Criteria:**

- [ ] [Live] One current goal with 1-7 short steps. Muse sets each step's minutes. The person changes the plan by
      talking ("make the first step smaller").
- [ ] [Later] Three levels: Goals (long-term, including life goals such as health, habits and personal projects) →
      Projects (weeks) → Steps (today).
- [ ] [Later] Zeno proposes goals and projects from what the person says, Canvas, the calendar and email. One tap
      confirms. Nothing needs typing or arranging.
- [ ] [Later] Every item shows its kind as a label: Deadline, Commitment (for example gym 3×/week), Step or
      Nice-to-have. Muse classifies it; the person can change it by saying so.
- [ ] [Later] In Do mode, goals live inside the Today sheet. No new screen.
- [ ] [Later] Sunday evening, Zeno offers one line: "3 goals moving, 1 slipping. Plan the week?" One tap gets a
      drafted week. (How the line reaches them: OQ-9.)
- [ ] [Live rule, kept] A health goal stays generic ("Walk 3 times a week"), never a condition's name.

**Dependencies:** C4 before E1 (triage needs kinds); D2.
**Status:** Partial
**Confidence:** [HIGH] for the model; [MEDIUM] for the check-up's delivery

#### D. What matters

**User story:** As Daniel Okafor, I want Zeno to weigh what is really at stake, so that the card shows the work that
matters and not busywork.

**Serves:** Daniel Okafor, Maya Torres, Rosa Delgado

**What Vi said:** Weigh "anything of relevance that we haven't thought of".

**Acceptance Criteria:**

- [ ] [Live] The first card is the one most urgent thing: the step already started, else the next one, unless another
      step unblocks the rest or is due sooner; with no plan, the nearest deadline from Canvas, the calendar or memory,
      planned into 3-5 steps.
- [ ] [Live] If the model fails, a rule pick still gives a card with Start.
- [ ] [Later] The pick weighs: stakes (points, grade weight, exam versus participation, people waiting), lead time
      (the due date versus how long it really takes this person), their stated goals, energy and time of day. Claude's
      additions, accepted: dependencies (what unblocks others), the consequences of not doing it, momentum (half-done
      work), repeated avoidance (it needs a smaller first step), overload (say no, protect rest) and opportunity
      windows (office hours before an exam).
- [ ] [Later] Zeno gives one line of why, for example "First: 15% of your grade, due Fri" (where it shows: OQ-14).

**Dependencies:** H5 for grade weights; I2 for "how long it really takes this person".
**Status:** Partial
**Confidence:** [HIGH]

#### E. Missed work

**User story:** As Rosa Delgado, I want missed work re-planned quietly, so that a bad day does not turn into a guilty
week.

**Serves:** Rosa Delgado, Maya Torres

**Acceptance Criteria (Claude's proposal, accepted by Vi):**

- [ ] [Later] Muse triages each missed item by kind.
- [ ] [Later] A missed Deadline or Commitment moves quietly to the next good slot.
- [ ] [Later] A missed Nice-to-have slides later, silently.
- [ ] [Later] An item at risk (it no longer fits before its due date) or slid twice gets one inline question the next
      time they open Zeno, for example "Section 4.2 slid twice. [Tomorrow] [Let it go]". Never a notification; at most
      one such question a day.

**Dependencies:** C4 (kinds); G4 for calendar moves.
**Status:** Not Started
**Confidence:** [HIGH] for the rules; [MEDIUM] for moving calendar events (OQ-10)

#### F. Plan mode (the first big project after Nov 4)

**User story:** As Daniel Okafor, I want one workspace where all my goals and projects sit with their files, emails and
links, and where Zeno suggests the next move, so that I can see the whole picture without keeping it tidy myself.

**Serves:** Daniel Okafor, Rosa Delgado, Maya Torres

**What Vi said:** Vi wants a full workspace ("boards, multiple projects that I assign, drag and drop") with simple
navigation, not a page per goal: "a place where people can pull certain tasks. Everything has to be integrated from
each other." Zeno's panel is a must: "I don't want to make it like a general chat wrapper or a general harness or
general agent, I want it to be a really proactive agent." Make it impressive.

**Acceptance Criteria:**

- [ ] [Later] A Do · Plan toggle. Do stays the home: one card, one big button, "just do" the next task.
- [ ] [Later] Left, the project cloud: every goal and project with its context (files, emails, links, Canvas, notes).
      Dropping something onto a project adds it as context.
- [ ] [Later] Center, a flexible stage that changes with what you are doing: the board (Today / This week / Later;
      drag steps in from any project), a goal workspace (edit the goal and its timeline, break tasks into small steps,
      see the timeline change) or the calendar (drag to schedule).
- [ ] [Later] Right, Zeno: proactive one-tap suggestions ("PHIL paper is slipping, add a session Thu?") and a chat
      scoped to what is selected, with a Muse model picker that never offers a `*-contributor` model.
- [ ] [Later] Subject help: tutoring, planning, and ideas for an outline or a first sentence; the person writes. A
      scratchpad per project. Never does the work wholesale.

**Dependencies:** C2-C4 (the goal model), G3 (calendar writes), H6 (dropping things in), K5 (one API).
**Status:** Not Started
**Confidence:** [HIGH] for the layout; [LOW] for the details, which the epic and an RFC will settle with Vi

#### G. Calendar

**User story:** As Maya Torres, I want Zeno to put the big things on my real calendar and keep small steps off it, so
that my calendar stays readable and never pings me for Zeno.

**Serves:** Maya Torres, Daniel Okafor, Rosa Delgado

**What Vi said:** The calendar is for big or time-set things; never small steps: "writing all the small little goals…
might waste space". Zeno's events look distinct, not a separate "Zeno" calendar: "people don't want to think that
much".

**Acceptance Criteria:**

- [ ] [Live] Zeno reads all the person's calendars. The Week is read-only and opens each event in Google Calendar.
- [ ] [Live] Zeno writes only when the person asks ("put it on my calendar") or for a commitment of 60 minutes or more.
      Each block takes one tap and can be undone. Small steps never go on the calendar.
- [ ] [Live] Blocks go to a separate "Zeno" calendar (the `calendar.app.created` scope).
- [ ] [Later] With a broader Google permission and re-consent, Zeno writes to the person's main calendar, and its
      events use one distinct color.
- [ ] [Later] Zeno's items carry a tag at the start of the title: [Suggested], [Moved], [Delayed] or [Postponed]
      (meanings: OQ-11). They never notify: reminders off. (Today's blocks carry a 10-minute popup: OQ-4.)
- [ ] [Later] Muse decides what is calendar-worthy: meetings, the gym, planned commitments, big work blocks.
- [ ] [Later] Exam prep: Zeno reserves or suggests study time, quietly, and helps with the material when asked.
- [ ] [Rule] Zeno acts on small things and asks before big ones, including events on the main calendar (OQ-10 says
      where [Suggested] and [Moved] events fall).

**Dependencies:** G3 needs a new Google scope and re-consent; Google's app verification for more than 100 users.
**Status:** Partial
**Confidence:** [HIGH] for the rules; [MEDIUM] for the tags

#### H. Capture, sources and integrations

**User story:** As Daniel Okafor, I want to throw anything at Zeno (an email, a link, a photo, a plan) and have it land
in the right project, so that capture costs me nothing.

**Serves:** Daniel Okafor, Maya Torres, Rosa Delgado

**Acceptance Criteria:**

- [ ] [Live] Talk or type anything. Paste a syllabus, a to-do list or notes (Memory's Add box takes pasted notes).
- [ ] [Live] First sign-in: "Reading your calendar and email…", then one line of what it found and [Start my day]. No
      setup questions. A quiet re-scan once a day.
- [ ] [Live] The inbox shows only people and school, one line each, with "Open Gmail". Mail Zeno writes opens as a
      Gmail draft; the person presses Send.
- [ ] [Live] Canvas: a personal access token kept only in the browser. Zeno reads 14 days of unsubmitted assignments,
      quizzes, discussions and exams; deadlines become memories; the 3 soonest instructions help plan and find
      sources and are never saved.
- [ ] [Later] Canvas everything: assignments, instructions, announcements, files, modules, pages, discussions, grades.
- [ ] [Later] Capture everything: forward an email, share a link or file, a photo of a page, a big master plan.
- [ ] [Later] Next sources: Outlook / Microsoft 365, Notion / Todoist, GitHub / Linear / Jira, Slack.
- [ ] [Later] Zeno is an MCP client, so "any MCP integration" plugs in.

**Dependencies:** K2 or K3 for sharing from other apps; L1 rules apply to every new source.
**Status:** Partial
**Confidence:** [HIGH]

#### I. Motivation and personality

**User story:** As Maya Torres, I want Zeno to be straight with me and make progress feel good, so that I come back
because it helps, not because I feel guilty.

**Serves:** Maya Torres, Daniel Okafor, Rosa Delgado

**What Vi said:** Direct, pushy, unfiltered by default: "straight to the point… I hate whenever it sugarcoats… pushes
you to the right direction". Claude's limits, accepted: blunt, never cruel or shaming; the trust rules are not tone.

**Acceptance Criteria:**

- [ ] [Live] Streak: one finished step counts for the day; one rest day per week; milestones at 3, 7, 14, 30, 50 and
      100 days; after 6 PM a one-tap 5-minute step keeps a live streak; after a break, no shame.
- [ ] [Live] Patterns from use (what they finish or skip, real lengths, time of day) shape the plan. Zeno never asks
      questions to learn.
- [ ] [Later] A short end-of-day recap. Goal progress shows (B4).
- [ ] [Later] Zeno says a newly noticed pattern out loud once (the day-2 version is OQ-5).
- [ ] [Nov 4 or Later, OQ-2] Direct by default. Blunt, never cruel or shaming.
- [ ] [Later] A tone setting: Gentle / Direct / Drill sergeant.
- [ ] [Rule] No tone changes the trust rules: never does the work, never sends mail without you, never keeps private
      data.

**Dependencies:** C6 and B4 for goal progress.
**Status:** Partial
**Confidence:** [HIGH]

#### J. Voice turn-taking

**User story:** As Maya Torres, I want Zeno to wait while I think out loud, so that it answers what I meant instead of
cutting me off.

**Serves:** Maya Torres, Rosa Delgado

**What Vi said:** "I pause two seconds… then the voice just interrupts me… leave space where people think."

**Acceptance Criteria:**

- [ ] [Live] Talk uses Muse Voice Transcribe (realtime, through Zeno's server relay). Web Speech is only a fallback;
      typing always works.
- [ ] [Nov 4] When the person pauses mid-sentence (it sounds unfinished: "and…", "so…", "because…"), Zeno keeps
      listening and does not answer, even after a 2-second pause (the wait: OQ-8, default 3 seconds).
- [ ] [Nov 4] When the person finishes a complete question, Zeno answers quickly (first words within about 2.5
      seconds: OQ-8).
- [ ] [Nov 4] A visible tap, "Done talking", ends the turn at once.
- [ ] [Later] Try other realtime voice providers. Meta's transcription stays for the hackathon.

**Dependencies:** none.
**Status:** Partial
**Confidence:** [HIGH] for the behavior; [MEDIUM] for the timings

#### K. Platforms

**User story:** As Daniel Okafor, I want Zeno on my lock screen and in my menu bar, so that the one thing is always one
glance away.

**Serves:** Daniel Okafor, Maya Torres, Rosa Delgado

**Acceptance Criteria:**

- [ ] [Live] The web app works in laptop and phone browsers, light and dark.
- [ ] [Later, first] An installable PWA. The brief says "PWA now"; the video does not need it, so it comes first after
      Nov 4 unless Vi wants it sooner (OQ-9, which also covers notifications).
- [ ] [Later] A SwiftUI iPhone app: a lock-screen Live Activity with the stopwatch and a Done button, widgets, Siri.
- [ ] [Later] A Mac menu-bar companion from the same code.
- [ ] [Later] An API-first server: the web app and the native apps use the same API.

**Dependencies:** K5 before K3 and K4.
**Status:** Partial
**Confidence:** [HIGH] for the order

#### L. Privacy and trust

**User story:** As Maya Torres, I want to know Zeno keeps my private life on my device and never watches me, so that I
can let it read my calendar, email and Canvas.

**Serves:** Maya Torres, Daniel Okafor, Rosa Delgado

**Acceptance Criteria:**

- [ ] [Live] Private facts (overall health, sexual orientation and gender identity, religion, politics, immigration
      status, money owed) stay only in the person's browser. Passwords and codes are never kept anywhere. Health stays
      generic everywhere ("Doctor check-in Nov 3").
- [ ] [Live] The Memory sheet shows everything Zeno keeps; each fact can be forgotten.
- [ ] [Live] No audio is stored; the chat stays in the browser; personal data never goes to a `*-contributor` model.
- [ ] [Nov 4] No surveillance: Zeno uses only its own tab's visibility. No screen recording, no app tracking, no
      idle-detection permission.
- [ ] [Live] Zeno asks before anything other people see: email is a draft; every calendar write takes a tap.

**Dependencies:** none.
**Status:** Partial
**Confidence:** [HIGH]

---

## 4. Functional Requirements

### Core Behaviours

The daily loop:

1. **Open.** The card is on screen at once (from the browser's cache). The model's line follows.
2. **Card.** One step, its minutes, goal · due. [Start · N min].
3. **Focus.** A stopwatch counts up (Nov 4). One soft check-in line (Nov 4). Music if wanted. Coming back to the tab
   shows "Back. N min on '<step>'." (Nov 4).
4. **Done.** One tap, the stamp, "Nice. Next: …" [Keep going]. Or "That's enough today": saved for next time.
5. **Talk, any time.** Plan, re-plan, book a big block, draft an email, ask for sources.
6. **Learn.** What they finish, skip and how long it really took become patterns that shape tomorrow.

First sign-in: the scan reads calendar and email (and Canvas if connected), says in one line what it found, then shows
the first card. No questions.

### Input/Output Specifications

| In | Out |
| --- | --- |
| Google Calendar (all calendars, read) | The card and Zeno's line (shown and, with Sound on, spoken) |
| Gmail (read; only people and school reach the inbox) | Calendar blocks (one tap; Undo) |
| Canvas (token on the device; 14 days of unsubmitted work) | Gmail drafts (the person sends) |
| Talk, typing, pasted notes | Memories (grouped, visible, deletable; private ones on the device) |
| Taps: Start, Done, Stuck?, Stop for now | Steps and goals; streak and patterns |

### Business Logic Rules

- **One name per task.** The card, the plan and any calendar block use the step's saved title.
- **First steps are small.** About 5 minutes, unless the person's patterns point to another length.
- **Calendar.** Write only when asked or for 60+ minutes; one tap; Undo; never small steps. Later: the main calendar,
  a distinct color, title tags, reminders off.
- **Autonomy.** Act on small things (re-plan, reorder, rename, capture). Ask before big ones (main calendar events,
  emails, anything other people see).
- **Nudge budget.** About one a day, or when something is critical (due today, an exam tomorrow) or about a long-term
  goal. Never for check-ins, calendar events or missed work.
- **Missed work.** Deadline or Commitment: move to the next good slot. Nice-to-have: slide. At risk or slid twice: one
  inline question, at most once a day.
- **Memory.** Rewordings merge; classes and shifts the calendar repeats are not saved; undated to-dos expire after 14
  days; deadlines expire the day after they are due.
- **Never the work.** No essays, answers or submissions. An outline idea or a first sentence is fine; the person
  writes.

---

## 5. Non-Functional Requirements

### Performance

Vi: "every 100-200 ms of delay costs a customer". Budgets (today's numbers are from production and local tests,
Oct 31 to Nov 2):

| Moment | Budget | Today |
| --- | --- | --- |
| The card on screen when Zeno opens (returning visit) | 200 ms or less | 40-220 ms (browser cache) |
| A tap acts (Start, Done) | Instant; the words follow | Instant |
| The cached card's Start is ready | 1 s or less | About 3 s (known issue) |
| Zeno's opening line (model) | 4 s or less | 2-4 s |
| Talk reply without a tool | 2 s or less | 0.7-1.8 s |
| Talk reply with a tool (plan, book, draft) | 4 s or less | 2.2-3.7 s |
| Voice: complete question → Zeno's first words | About 2.5 s (OQ-8) | Transcript about 0.6 s after speech ends, plus the reply |
| Voice: unfinished sentence → Zeno keeps waiting | 3 s of silence or more (OQ-8) | Cuts in after about 2 s |
| First sign-in: scan → first card | 20 s typical, 50 s at most | Model call 9-13 s; the card waits up to 50 s |
| Sources for a step | 8 s or less | 4-7 s |
| Return greeting | Instant (no network call) | Nov 4 |

### AI cost per person per day

**Proposed target (OQ-15):** about $0.10 or less per active person per day (median), and $0.25 or less for the
heaviest 5%. Vi also asked on Nov 2 for fewer, smaller AI calls.

**Estimate today**, from logged token counts and Meta's published prices (Muse Spark, Standard mode: $1.25 per million
input tokens, $0.15 cached, $4.25 output; Muse Voice Transcribe: $0.18 per hour of audio):

| Call | When | Tokens in / out | Cost each |
| --- | --- | --- | --- |
| Talk, one model round | Each message (two rounds when a tool runs) | about 3,000 / 250 | about $0.005 |
| Opening (card + line) | Each open | about 1,700 / 400 | about $0.004 |
| Daily scan | Once a day | about 6,000 / 1,000 (estimate, after `e716f09`) | about $0.012 |
| Sources | On tap | Muse web search | about $0.005 |
| Voice | While talking | - | about $0.003 per minute |

A typical active day (3 opens, 8 talk rounds, 1 scan, 1 sources, 5 minutes of voice) comes to about $0.08.

**How it is measured:** each model call already logs its tokens (`src/lib/ai.ts`, `prep.ts`). Add up a day's cost at
list prices and divide by the people who opened Zeno that day. Seeing the spread per person needs an opaque account key
on each log line (the same kind of key as the browser cache), never an email.

**Rules:** new judgments (the check-in moment, an item's kind) ride on calls Zeno already makes where possible. Prompt
caching is not used yet and is the first lever (cached input costs about an eighth). The Muse model picker (F4) shows
when a model costs more (Muse Wonder costs about 3-5 times as much).

### Accessibility

- Body text 18 px or larger; tap targets 44 px or taller; Atkinson Hyperlegible type; light and dark follow the
  system (`DESIGN.md`).
- Everything works by tap and keyboard. Voice is optional: typing works when the mic is blocked.
- Reduced motion is honored: no rise, stamp or ring animation.
- Zeno's line is read once by screen readers. The check-in line and the return greeting are plain text on the card: a
  screen reader can find them, but they never interrupt.
- No alarms, no flashing, no countdown pressure (A3).

### Security

- Google scopes stay minimal: read calendars, read Gmail, write only calendars Zeno created. The main calendar needs a
  broader scope and re-consent (G3).
- Secrets stay in `.env.local` and Vercel. The Canvas token stays in the browser.
- Model output is untrusted: every tool argument, time, title and URL is checked at the boundary.
- Known gap: the Google access token is readable from `/api/auth/session` (HANDOFF section 0).
- Rotate the Meta and Google keys after Nov 4 (HANDOFF section 8).

### Scalability

- The Google app is published but unverified: at most 100 users, and people see Google's warning screen. More users
  need Google's verification, and G3's broader scope makes verification stricter.
- Muse limits: 3,000 requests and 4 million tokens per minute for Muse Spark 1.3; 256 concurrent voice streams.
- Memory holds about 120 facts per person in the prompt (no embeddings: Meta has none). Beyond that, add full-text
  search (VI-318).

### Availability

- Production stable by the morning of Nov 4. Proposal: after the Nov 4 items ship, only fixes go to `main` until the
  video is done.
- Every way out lands on the home card with its Start (no dead ends).
- When the model fails, rules take over (rule pick, rule line) and errors say so plainly ("I couldn't think that
  through just now. Try again?").
- Zeno never claims a booking Google did not confirm.
- A failed first scan is retried on the next open. Canvas is capped at 30 seconds.
- Every merge passes the checks in `CLAUDE.md`.

---

## 6. AI/ML Specifications

### Models and Providers

| Model | Used for | Notes |
| --- | --- | --- |
| `muse-spark-1.3` (Standard mode) | Talk (tool-using agent), the opening and first-card pick, the first and daily scan, pasted notes | `reasoning_effort` always set (`minimal` today); strict JSON replies |
| `muse-spark-1.3` through the Responses API with `web_search` | Sources for a step | Only the goal and step titles are sent |
| `muse-voice-transcribe-1.0` (realtime, endpointing) | Talk | Through a WebSocket relay on Vercel; keyword biasing |
| Google Chirp 3 HD "Achernar" | Zeno's voice | Meta has no text-to-speech |

Personal data never goes to `*-contributor` models (Meta's terms). Zeno never presents itself as human.

### What Muse decides

| Decision | Ships |
| --- | --- |
| The first card and its why; the opening line | Live |
| Steps and each step's minutes | Live |
| What to remember (grouped, private ones flagged) | Live |
| Each step's check-in moment | Nov 4 |
| Item kind (Deadline, Commitment, Step, Nice-to-have) | Later |
| What is calendar-worthy | Later (a rule today) |
| Missed-work triage | Later |
| The full "what matters" weighing | Later |
| Plan mode suggestions; subject help | Later |

### Prompt Patterns

- One system prompt with the persona and the trust rules; tools for goals, steps, memory, calendar offers and drafts
  (`set_goal`, `update_steps`, `start_step`, `finish_step`, `remember`, `forget`, `propose_block`, `draft_email`).
- Replies are strict JSON (`say` plus up to three tap options), so people tap instead of typing.
- A tool call arrives with a future-tense preamble; it is never spoken as a result.

### Context Management

In prompt order: persona and memories (stable), then today's calendar and inbox (live), Canvas briefs, the current
goal and steps, the last 12 turns (kept in the browser, never stored), then the new message. Private facts come from
the device with each request and are never saved by the server.

### When AI fails

Rules take over: a rule pick for the card, a rule line for the opening. A tool argument that fails validation is sent
back to the model or dropped. The person always keeps a working Start.

---

## 7. Data Architecture

### Data Models

Today (Neon Postgres, `src/lib/db.ts`, created by `ensureSchema`):

| Table | Holds |
| --- | --- |
| `goals` | Title, status, due date |
| `steps` | Goal, title, minutes, position, status (todo, doing, done, skipped), started and done times, sources, calendar event |
| `memories` | Text, group, source (you, calendar, email, pattern, canvas), expiry |
| `user_state` | The Zeno calendar's id, the last scan, forgotten facts |
| `tasks` | Older to-dos (not used by the current flow) |

In the browser only: the private vault (`zeno.vault.<account>`), the Canvas link and briefs (`zeno.canvas.<account>`),
and the cached day (keyed by an opaque account key).

### Relationships and Constraints

Steps belong to a goal (deleted with it). Each memory text is unique per person. One goal is current at a time today.

### Storage Mechanisms

**Later additions** (shapes are decided in the epics): projects between goals and steps; an item kind; each step's
check-in moment; how many times an item slid; a once-a-day "opened" mark for O3. The return greeting needs nothing new:
it uses the step's start time.

**Never stored:** audio, chat transcripts, raw pasted notes, the emails themselves, Canvas instructions.

---

## 8. Integration Map

### External Services

| Service | Use | Ships |
| --- | --- | --- |
| Google Calendar API | Read all calendars; write Zeno's own calendar | Live |
| Gmail API | Read; drafts open in Gmail's compose window (no send scope) | Live |
| Canvas REST API | 14 days of unsubmitted work; instructions | Live |
| Meta Muse API | Chat completions, Responses with web search, realtime speech to text | Live |
| Google Cloud Text-to-Speech | Zeno's voice | Live |
| Neon Postgres | Goals, steps, memories, state | Live |
| Google Calendar (broader scope) | Main calendar, distinct color, tags | Later |
| Microsoft Graph, Notion, Todoist, GitHub, Linear, Jira, Slack | More sources | Later |
| MCP servers | Zeno as an MCP client | Later |

### Authentication Methods

Google sign-in through Auth.js with scopes `openid email profile`, `calendar.readonly`, `calendar.app.created`,
`gmail.readonly`. Canvas uses the person's own access token from the browser. Meta and Google TTS keys stay on the
server.

### Third-Party Dependencies

`next`, `react`, `react-dom`, `next-auth`, `@neondatabase/serverless`, `@vercel/functions`, `ws` (see
`package.json`).

---

## 9. Configuration Reference

### Environment Variables

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `AUTH_SECRET` | Auth.js session secret | Yes | - |
| `AUTH_GOOGLE_ID` | Google OAuth client id | Yes | - |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Yes | - |
| `META_MODEL_API_KEY` | Meta Muse API key | Yes, for AI | AI is marked simulated without it |
| `GOOGLE_TTS_API_KEY` | Google Text-to-Speech key | No | The browser voice |
| `DATABASE_URL` | Neon Postgres | Yes, for saving | Database features off |

### Feature Flags

None. The dev-only gallery at `/preview` shows every screen (a 404 in production).

---

## 10. Quality Assessment

### Tested Functionality

- 19 self-checks (`src/**/*.check.ts`), `scripts/listen-check.mjs` and the memory benchmark (`scripts/memory-bench.mjs`:
  96.1 overall, 96.9 privacy on Nov 2).
- Live tests on production with the demo account (Nov 1 and Nov 2): first sign-in, the card, focus, Done, talk,
  booking with Undo, a Gmail draft, the Week, the Memory list.

### Untested Areas

- Canvas with a real token end to end (VI-324); voice with a real microphone in the Nov 2 round.
- The daily re-scan and hands-free listening, live.
- Safari and iOS; dark mode in a live run.

### Technical Debt

The live list is in `HANDOFF.md` section 0 ("Known issues"). The ones that touch this PRD: a talk offer can sit right
after another block; near-duplicate facts with different date words; a fallback card can disagree on minutes;
coursework that names a condition is dropped (OQ-17); the greeting uses the Google first name; the cached card's Start
arrives about 3 s late.

---

## 11. Open Questions

Each question has a default. Group A matters before Nov 4; group B can wait for the epic reviews.

### A. Before Nov 4

- **OQ-1. Mission line.**
  **Context:** the video opens and closes with it.
  **Options:** A, B or C (section 1). **Default:** A + "From 'I should' to 'I did.'"; the paradox as the opener.
- **OQ-2. Direct tone now?**
  **Context:** the brief makes "direct" the default; today's prompt says "warm, candid friend". The video shows Zeno's
  lines. **Default:** switch now (a prompt change), blunt but never cruel.
- **OQ-3. The small Done sound for Nov 4?**
  **Context:** part of "coming back is rewarding". **Default:** yes, a short soft sound made in the browser (no
  file), only when Sound is on.
- **OQ-4. Reminders off on Zeno's blocks now?**
  **Context:** the brief says Zeno's events never notify; today each block has a 10-minute popup. **Default:** turn
  them off now.
- **OQ-5. Day 2: should Zeno say what it learned?**
  **Context:** patterns save silently today, so day 2 is smarter but may not say so. **Default:** the first opening
  after a new pattern mentions it once ("You finish most before noon, so the hard one first.").
- **OQ-6. Spoken heads-ups before events.**
  **Context:** live today (once per event, Sound on), but "very few nudges" and a quiet focus. **Default:** keep for
  timed events only, never during focus. Option: drop them.
- **OQ-7. When does "Back." show?**
  **Context:** a quick glance at another tab should not trigger it. **Default:** after 1 minute away.
- **OQ-8. Voice timings.**
  **Context:** Vi pauses about 2 seconds while thinking. **Default:** wait 3 seconds after an unfinished sentence;
  answer a complete question within about 2.5 seconds; Claude tunes with Vi's own test.

### B. At the epic reviews (after Nov 4)

- **OQ-9. The PWA, and how nudges reach people.**
  **Context:** "PWA now (installable, notifications)", but check-ins, calendar and missed work never notify. When does
  the PWA ship, and where do the once-a-day nudge and the Sunday check-up appear? **Default:** the PWA right after
  Nov 4; until then nudges show in Zeno when they open it; after it, at most one opt-in notification a day.
- **OQ-10. [Suggested] and [Moved] on the main calendar.**
  **Context:** Zeno "asks before big ones (main calendar events)", yet missed work "quietly moves".
  **Default:** a new event takes one tap and is then written as "[Suggested] …"; Zeno moves only events it created,
  quietly, with [Moved], [Delayed] or [Postponed]; it never moves the person's own events without asking.
- **OQ-11. What each tag means.**
  **Default:** [Moved] a new time the same day; [Postponed] another day; [Delayed] its due date moved (an extension);
  [Suggested] Zeno proposed it.
- **OQ-12. What the check-in learns from.**
  **Default:** only what Zeno already learns (real step lengths, time of day). No new tracking.
- **OQ-13. The daily "did these get done?" moment.**
  **Default:** the first open of the day, before the card.
- **OQ-14. Where the one line of why shows.**
  **Context:** a line on the card adds clutter. **Default:** in Zeno's spoken or written line, not on the card.
- **OQ-15. Targets.**
  **Context:** the four measures are Vi's; the numbers are proposals. **Default:** the targets in "Success metrics" and
  "AI cost", reviewed after the first 10 real users.
- **OQ-16. Measuring stress.**
  **Context:** measuring it means asking, and Zeno never asks to learn. **Default:** one skippable 1-5 tap on day 1
  and day 14, kept as a number only. Option: interviews only.
- **OQ-17. Coursework that names a condition** (from HANDOFF section 0).
  **Context:** "PSYCH 1: Quiz 3: Anxiety Disorders" is dropped, even as a Canvas deadline. **Default:** keep coursework
  titles from Canvas as deadlines, still never as personal facts.
- **OQ-18. The Muse model picker.**
  **Default:** Muse Spark 1.3 (the default) and Muse Wonder, with a note that Wonder costs more; never a
  `*-contributor` model.

---

## Changelog

| Date | Version | Changes |
| --- | --- | --- |
| 2026-11-02 | 0.1 | First draft from Vi's 40 answers (the night of Nov 2-3) and the code at `e716f09`. Awaiting Vi's approval. |

---

> **Confidence Markers:** [HIGH] decided by Vi and clear | [MEDIUM] decided, details open | [LOW] needs Vi
>
> **Status Values:** Complete | Partial | Stubbed | Broken | Not Started
