# EP0011: Canvas, all of it

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #7 of 12
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** H5; OQ-17

## Summary

Zeno reads all of Canvas, not just the next 14 days of unsubmitted work: assignments, instructions, announcements,
files, modules, pages, discussions and grades. It uses them to plan better (grade weights feed "what matters"), prep
better (instructions and files feed Sources and subject help) and notice what is new (announcements). The token still
stays on the device, and Zeno never submits, writes answers or changes anything in Canvas.

**Goal:** a student never has to open Canvas to know what matters next.

## Business Context

### Problem Statement

Today Zeno reads 14 days of unsubmitted assignments, quizzes, discussions and exams, and the instructions of the 3
soonest. It cannot see a grade weight, a new announcement or a module's files. Vi connected a real Canvas on Nov 2 and
found it "kind of messy… It doesn't have the context. I think it needs some sort of AI to organize it".
([PRD section H](../prd.md#h-capture-sources-and-integrations))

**What the brief says (§7):** Canvas: everything (assignments, instructions, announcements, files, modules, pages,
discussions, grades).

### Value Proposition

- **With it:** the card can say "First: 15% of your grade", and Sources can point at the professor's own files.
- **Without it:** stakes are guessed, and new announcements are missed.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Canvas items Zeno can read | 4 kinds, 14 days | 8 kinds | Feature check |
| Picks whose why names a grade weight | 0 | Proposed with Vi | Opening lines that cite a weight |

## Scope

### In Scope

- Assignments with points and assignment-group weights; announcements; files; modules; pages; discussions; grades.
- Grades used only to weigh what matters; how they show is OQ below.
- The same trust rules: a device-only token, nothing written to Canvas, instructions never stored, codes and
  passwords never kept.

### Out of Scope

- Writing anything to Canvas. Never.
- Showing grades in the video or the card (DEMO-NOV4.md: "Show Canvas lists, never grades").
- Other learning platforms (Blackboard, Moodle): not asked.

### Affected Personas

- **Maya Torres (Primary):** five courses, one Canvas that "shows everything at once".
- **Rosa Delgado:** two online courses a term.

## Acceptance Criteria (Epic Level)

- [ ] Zeno reads the eight kinds of Canvas content with the device-only token.
- [ ] Grade weights reach the "what matters" weighing (EP0008).
- [ ] New announcements reach Zeno's context, so the plan can use them. (What Zeno does with one that moves a
      deadline is an open question.)
- [ ] Nothing is ever written to Canvas, and no instruction text is stored.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0008 | Epic | Grade weights for the weighing |
| EP0007 | Epic | Canvas files and pages as project context |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Slow schools pass the 30-second cap | Medium | Medium | Read in parts; cache per day in the browser |
| Coursework titles that name a condition are dropped today | High | Medium | OQ-17 |
| Grades are sensitive | Medium | Medium | Used for weights only; shown only if Vi says so |

## Technical Considerations

### Architecture Impact

- `src/lib/canvas.ts`, `src/lib/canvas-store.ts`, `src/app/api/canvas/route.ts`.

## Sizing

**Size:** M

**Estimated Story Count:** 6

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-17: keep coursework titles that name a condition ("PSYCH 1: Quiz 3: Anxiety Disorders") as Canvas
      deadlines? Default: yes, as deadlines, still never as personal facts. - Owner: Vi
- [ ] Do grades ever show to the person in Zeno? Default: no, they only weigh the pick. - Owner: Vi
- [ ] An announcement that moves a due date: does Zeno update the deadline quietly, or ask? Default: update it
      quietly and say so in the next opening line. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
