# EP0007: Plan mode: the workspace

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** XL
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #3 of 12 (Vi's "first big project after Nov 4", built on EP0006)
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** F1, F2, F3, F4, F5; OQ-18

## Summary

A Do · Plan toggle. Do stays the home: one card, one big button, "just do" the next task. Plan is one workspace for
the big picture. Left: the project cloud, every goal and project with its context (files, emails, links, Canvas,
notes); drop things onto a project to add context. Center: a stage that changes with what you are doing (the board
Today / This week / Later, a goal's own workspace with its timeline, or the calendar to drag-schedule). Right: Zeno,
with one-tap suggestions ("PHIL paper is slipping, add a session Thu?") and a chat scoped to what is selected, with a
Muse model picker. Subject help and a scratchpad per project.

**Goal:** see and shape everything in one place, while Zeno keeps it tidy and suggests the next move.

## Business Context

### Problem Statement

Do mode shows one thing on purpose. Some moments need the whole picture: the start of a term, a busy week, a project
with many parts. Today there is nowhere to see all goals together or to move work between them.
([PRD section F](../prd.md#f-plan-mode-the-first-big-project-after-nov-4))

**What Vi said:** a full workspace ("boards, multiple projects that I assign, drag and drop") with simple navigation,
not a page per goal: "a place where people can pull certain tasks. Everything has to be integrated from each other."
On Zeno's panel: "I don't want to make it like a general chat wrapper or a general harness or general agent, I want
it to be a really proactive agent." Make it impressive.

### Value Proposition

- **With it:** Daniel sees his six tools' work as one board; Rosa lays out a term once and never touches it again.
- **Without it:** the long view lives in people's heads, which is the work Zeno promises to take away.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Zeno suggestions accepted in Plan mode | Not possible | Proposed with Vi | Taps on suggestions against suggestions shown |
| Time in Plan mode per week | Not possible | Short (it is a checkpoint, not a second job) | Session length, opt-in measure |

## Scope

### In Scope

- The Do · Plan toggle; Do stays the home. (F1)
- Left: the project cloud with each goal's and project's context; drop to add context. (F2)
- Center: the board (Today / This week / Later; drag steps in from any project), the goal workspace (edit the goal and
  its timeline, break tasks into small steps, see the timeline change), the calendar (drag to schedule). (F3)
- Right: Zeno's proactive one-tap suggestions and a chat scoped to the selection, with a Muse model picker that never
  offers a `*-contributor` model. (F4)
- Subject help: tutoring, planning, ideas for an outline or a first sentence; the person writes. A scratchpad per
  project. (F5)

### Out of Scope

- A page per goal (Vi: not a page per goal).
- A general chat. Zeno's panel is scoped and proactive.
- Zeno doing the work: no essays, answers or submissions; an outline idea or a first sentence at most.
- Editing in the Do mode Week: it stays read-only.

### Affected Personas

- **Daniel Okafor:** the board across his projects and people waiting on him.
- **Rosa Delgado:** lays out a term once ("drops her two syllabi onto her Degree goal").
- **Maya Torres (Primary):** the start of a semester; Do mode stays her home.

## Acceptance Criteria (Epic Level)

- [ ] One toggle moves between Do and Plan; Do is where Zeno opens.
- [ ] All goals and projects show in the left cloud with their context; dropping a link or file on one adds it.
- [ ] Steps can be dragged from any project onto Today, This week or Later, and onto the calendar.
- [ ] Zeno's panel offers one-tap suggestions without being asked, and its chat knows what is selected.
- [ ] The model picker offers only allowed Muse models and says when one costs more.
- [ ] Subject help suggests an outline or a first sentence and never writes the work.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0010 | Dragging onto the main calendar; until then, drag books on Zeno's own calendar with a tap | Draft |
| EP0012 | Dropping files from outside the app | Draft |
| An RFC on the layout and the phone version | The PRD's confidence for the details is LOW | Not started |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0012 | Epic | "Drop onto a project" is one of the capture paths |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A workspace feels overwhelming next to Do mode | Medium | High | Do stays the home; Plan opens only when chosen; Zeno keeps it tidy |
| Too big to ship in one go (XL) | High | Medium | An RFC first, then a thin first release: the cloud plus the board plus suggestions |
| The model picker raises costs | Medium | Medium | Spark is the default; costlier models say so (OQ-18) |

## Technical Considerations

### Architecture Impact

- A new screen family beside the Guided day, on the goal model from EP0006.
- Drag and drop on the board and the calendar; the calendar write rules of EP0010 apply.

## Sizing

**Size:** XL

**Estimated Story Count:** 12 or more (after the RFC)

**Complexity Factors:**

- A whole new surface that must still feel "not overwhelming".

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic and its RFC.

## Open Questions

- [ ] OQ-18: which models the picker offers. Default: Muse Spark 1.3 (default) and Muse Wonder with a cost note;
      never `*-contributor` models. - Owner: Vi
- [ ] Plan mode on a phone. Default: one column with three tabs (Cloud · Stage · Zeno). - Owner: Vi
- [ ] What "make it impressive" means for the first release. Default: settled in the RFC with mockups. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
