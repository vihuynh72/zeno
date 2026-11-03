# EP0006: Goals, projects and steps, managed quietly

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** L
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #3 of 13 (the foundation of Plan mode, Vi's first big project after Nov 4)
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** C2, C3, C4, C5, C6, B4; "The quiet way to manage long-term goals and projects"

## Summary

People say what they want once ("finish my degree by 2028", "gym three times a week"), or Zeno notices it in Canvas,
the calendar or email. Zeno proposes the goal, its projects and today's step; one tap confirms. Every item gets a
kind (Deadline, Commitment, Step, Nice-to-have) so Zeno's choices make sense. A long-term goal shows up only as
today's step, when it is its turn, and a simple rule says whose turn it is, so a goal with no deadline still moves.
Once a week, on Sunday evening, one line: "3 goals moving, 1 slipping. Plan the week?" One tap drafts the week, and
the card follows it.

**Goal:** long-term goals keep moving without anyone managing a planner. Zeno is "a quiet part in their life".

## Business Context

### Problem Statement

Today Zeno holds one current goal with 1 to 7 steps. Starting a new goal pauses the old one. There are no projects,
no kinds and no weekly view, so a degree, a habit and a paper due Friday cannot live side by side.
([PRD section C](../prd.md#c-goals-projects-and-steps))

**What Vi said:** "an agent that manages everything so they never have to manage." People can edit, but "They can just
tell Zeno." And Vi's question this round: "how do you make sure that people can manage their project, or manage
their life, manage their goal, and their really long-term goal?… Something that doesn't require people to augment
their life too much. Just be a quiet part in their life that they would love to be a part of."

### How it stays quiet (the answer to Vi's question)

1. **People talk; Zeno structures.** No forms, no fields, no setup.
2. **Every item has a kind**, shown as a label, so a skipped walk and a missed deadline are handled differently.
3. **A long-term goal shows up only as today's step, when it is its turn.** The home stays one card. Whose turn it
   is: work due soon first, as today; otherwise the goal that moved least recently; a commitment gets as many turns
   as its weekly count. Without this rule, a goal with no near deadline (Rosa's degree, "gym 3 times a week") would
   never win the card, and the Sunday line would call it "slipping" every week.
4. **One ritual a week, one line long.** Sunday evening, one tap; then the card follows the drafted week.
5. **Slips are handled quietly** (EP0008), and the big picture is there when wanted (EP0007), kept tidy by Zeno.

### Value Proposition

- **With it:** Rosa's degree, her walks and this week's quiz live in one place she never has to maintain.
- **Without it:** Zeno helps with today, but anything longer than a plan falls out of view.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| People with a goal longer than 4 weeks that moved this week | Not possible | Proposed with Vi (OQ-15) | Goals with a finished step in the last 7 days |
| Deadlines met (O2) | Partly measurable | 85% or more (proposed, OQ-15) | Steps of a goal with a due date, done by then |
| Taps to set up a long-term goal | Not possible | 1 (a confirm) | Manual |

## Scope

### In Scope

- Three levels: goals (long-term, life goals included: health, habits, personal projects) → projects (weeks) → steps
  (today). Many goals at once.
- Zeno proposes goals and projects from talk, Canvas, the calendar and email. One tap confirms. Nothing needs typing
  or arranging; changes are said ("make it twice a week").
- Kinds as labels: Deadline, Commitment (gym 3 times a week), Step, Nice-to-have. Muse classifies; the person can say
  otherwise. "Step" is also the name of the smallest level, so which items carry which kinds, and what a Step is as a
  kind, is settled with Vi in this epic's RFC (OQ-23).
- Whose turn it is, a simple rule until EP0008's full weighing: work due within its lead time comes first, as today;
  otherwise the card offers the next step of the active goal that moved least recently; a Commitment gets as many
  turns on the card as its weekly count; after the Sunday drafted week is confirmed, the card follows it.
- In Do mode, goals live inside the Today sheet. No new screen.
- The goal's progress bar moves on Done. (B4)
- The Sunday evening check-up: one line and a one-tap drafted week. A long-term goal reaches people through this line
  or the daily nudge, never a nudge of its own (EP0005, OQ-9).
- Health goals stay generic ("Walk 3 times a week"), never a condition's name (the privacy rule).

### Out of Scope

- The Plan mode workspace: EP0007 shows these goals.
- Re-planning missed work: EP0008.
- Writing to any calendar. The drafted week lives in Zeno (the card and the Today sheet follow it) until EP0010 puts
  its big blocks on the person's main calendar. Vi said no to a separate "Zeno" calendar ("people don't want to think
  that much"), so this epic adds no writes to it; the Live rule (a block only when asked, or for 60 minutes or more)
  is unchanged.

### Affected Personas

- **Rosa Delgado:** chosen for this question. A degree by spring 2028, walks three times a week, no planner.
- **Daniel Okafor:** "Keep a life goal alive in busy weeks: run three times a week."
- **Maya Torres (Primary):** a semester of projects; she still sees one card.

## Acceptance Criteria (Epic Level)

- [ ] A person can say a long-term goal once and see its first step on the card in the same conversation.
- [ ] Zeno proposes goals and projects; one tap confirms; no screen asks anyone to type or arrange.
- [ ] Every item that carries a kind shows it as a label (which items carry which kinds: OQ-23).
- [ ] The home stays one card; goals show inside the Today sheet.
- [ ] With nothing due soon, the card offers the next step of the active goal that moved least recently.
- [ ] A goal with no deadline reaches the card at least twice a week (proposed number, OQ below), unless the person
      lets it go.
- [ ] A Commitment of N times a week gets N turns on the card that week.
- [ ] The goal's progress bar moves when a step is done.
- [ ] Sunday evening shows one line ("N goals moving, M slipping. Plan the week?") and one tap drafts the week; the
      card then follows the drafted week.
- [ ] Nothing in this epic writes to a calendar.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0005 | The Sunday line's channel; until it ships, the line shows in the app | Draft |
| EP0010 | Puts the drafted week's big blocks (commitments, big work) on the main calendar; until then the week lives in Zeno | Draft |
| EP0008 | The full weighing replaces this epic's simple turn rule | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0007 | Epic | Plan mode shows and edits these goals and projects |
| EP0008 | Epic | Re-planning by kind needs the kinds |
| EP0009 | Epic | Done from the source marks these steps and moves these bars |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Zeno proposes a structure that feels wrong | Medium | Medium | One-tap confirm; "change it" in words; nothing saved without the tap |
| Moving from one goal at a time to many breaks today's flow | Medium | High | An RFC on the data model first; the card still shows one step |
| Too many goals, too little time | Medium | Medium | Overload is weighed in EP0008 ("say no, protect rest") |

## Technical Considerations

### Architecture Impact

- Today: `goals` (one `active`, others `paused`) and `steps` in `src/lib/goals.ts` and `src/lib/db.ts`. New: projects
  between goals and steps, a kind on each item, and many active goals. An RFC settles the shapes before stories.

## Sizing

**Size:** L

**Estimated Story Count:** 8

**Complexity Factors:**

- A data model change under a live product.
- Muse proposals that must be validated like every other model output.

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Why this comes before Plan mode

Plan mode is Vi's first big project after Nov 4 (brief §5). This epic is its foundation: Plan mode shows these goals
and projects. Building the model first means the workspace is built once. It is also the direct answer to Vi's
question about long-term goals.

## Open Questions

- [ ] Treat this epic and EP0007 as one "Plan mode" project, with this part first? Default: yes. - Owner: Vi
- [ ] How the Sunday line reaches people (OQ-9). Default: in the app until EP0005 ships; then it is Sunday's one
      nudge, sent in the evening instead of the morning. - Owner: Vi
- [ ] How many goals can be active at once? Default: no limit; the card still shows one step. - Owner: Vi
- [ ] Does a project need a due date? Default: no, optional. - Owner: Vi
- [ ] How often a goal with no deadline gets a turn. Default: at least twice a week, on the days it fits. - Owner: Vi
- [ ] OQ-23: what "Step" means as a kind. Default: a one-off task with no date of its own; a missed Step slides like a
      Nice-to-have unless its goal is at risk, then it moves like a Deadline. Option: kinds belong to goals and
      projects, and steps inherit them. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief and Vi's question about long-term goals |
| 2026-11-03 | Claude | Review fixes: a simple turn rule so a goal with no deadline still reaches the card; the drafted week lives in Zeno until EP0010 (no separate Zeno calendar); what Step means as a kind is OQ-23; long-term goals ride in the daily nudge or the Sunday line; #3 of 13 |
