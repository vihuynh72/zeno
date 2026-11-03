# EP0006: Goals, projects and steps, managed quietly

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** L
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #2 of 12 (the foundation of Plan mode, Vi's first big project after Nov 4)
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** C2, C3, C4, C5, C6, B4; "The quiet way to manage long-term goals and projects"

## Summary

People say what they want once ("finish my degree by 2028", "gym three times a week"), or Zeno notices it in Canvas,
the calendar or email. Zeno proposes the goal, its projects and today's step; one tap confirms. Every item gets a
kind (Deadline, Commitment, Step, Nice-to-have) so Zeno's choices make sense. A long-term goal shows up only as
today's step, when it is its turn. Once a week, on Sunday evening, one line: "3 goals moving, 1 slipping. Plan the
week?" One tap drafts the week.

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
3. **A long-term goal shows up only as today's step, when it is its turn.** The home stays one card.
4. **One ritual a week, one line long.** Sunday evening, one tap.
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
  otherwise.
- In Do mode, goals live inside the Today sheet. No new screen.
- The goal's progress bar moves on Done. (B4)
- The Sunday evening check-up: one line and a one-tap drafted week. Long-term-goal nudges count toward the one-a-day
  budget (EP0005).
- Health goals stay generic ("Walk 3 times a week"), never a condition's name (the privacy rule).

### Out of Scope

- The Plan mode workspace: EP0007 shows these goals.
- Re-planning missed work: EP0008.
- Writing the drafted week to the main calendar: EP0010. Until then, the Live rule holds: calendar blocks only when
  asked or for 60 minutes or more, on Zeno's own calendar.

### Affected Personas

- **Rosa Delgado:** chosen for this question. A degree by spring 2028, walks three times a week, no planner.
- **Daniel Okafor:** "Keep a life goal alive in busy weeks: run three times a week."
- **Maya Torres (Primary):** a semester of projects; she still sees one card.

## Acceptance Criteria (Epic Level)

- [ ] A person can say a long-term goal once and see its first step on the card in the same conversation.
- [ ] Zeno proposes goals and projects; one tap confirms; no screen asks anyone to type or arrange.
- [ ] Every goal, project and step shows its kind as a label.
- [ ] The home stays one card; goals show inside the Today sheet.
- [ ] The goal's progress bar moves when a step is done.
- [ ] Sunday evening shows one line ("N goals moving, M slipping. Plan the week?") and one tap drafts the week.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0005 | The Sunday line's channel; until it ships, the line shows in the app | Draft |

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
- [ ] How the Sunday line reaches people (OQ-9). Default: in the app until EP0005 ships, then one notification. -
      Owner: Vi
- [ ] How many goals can be active at once? Default: no limit; the card still shows one step. - Owner: Vi
- [ ] Does a project need a due date? Default: no, optional. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief and Vi's question about long-term goals |
