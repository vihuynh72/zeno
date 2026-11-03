# EP0008: What matters first, and quiet re-planning

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** L
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #6 of 13
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** D2, E1; OQ-10, OQ-14

## Summary

The card's pick weighs what is really at stake, not just what is due first, and says why in one line ("First: 15% of
your grade, due Fri"). When work slips, Zeno re-plans quietly by kind: a deadline or a commitment moves to the next
good slot, a nice-to-have slides. Only something at risk, or slid twice, gets one question the next time the person
opens Zeno: "Section 4.3 slid twice. [Tomorrow] [Let it go]". Never a notification; at most one such question a day.

**Goal:** the one card is the work that matters, and a bad day never turns into a guilty week.

## Business Context

### Problem Statement

Today the first card picks the step already started, else the next one, else the nearest deadline. It does not
weigh stakes, and nothing happens to work that slips: it just waits.
([PRD sections D and E](../prd.md#d-what-matters))

**What Vi said:** weigh "anything of relevance that we haven't thought of". The missed-work rules were Claude's
proposal, and Vi accepted them.

### Value Proposition

- **With it:** Maya works on what moves her grade; Rosa's missed walk moves to Thursday without a word.
- **Without it:** busywork can win the card, and slipped work piles up until it is an emergency.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Deadlines met (O2) | Partly measurable | 85% or more (proposed, OQ-15) | Goal steps done by the due date |
| Inline questions per person per day | 0 | 1 at most | Server count |

## Scope

### In Scope

- The weighing (D2): stakes (points, grade weight, exam versus participation, people waiting), lead time (the due date
  against how long it really takes this person), their stated goals, energy and time of day. Claude's additions,
  accepted: dependencies (what unblocks others), consequences of not doing it, momentum (half-done work), repeated
  avoidance (needs a smaller first step), overload (say no, protect rest), opportunity windows (office hours before an
  exam).
- One line of why with each pick (where it shows: OQ-14).
- Missed-work triage by kind (E1): Deadline or Commitment moves to the next good slot; Nice-to-have slides silently;
  a missed Step follows OQ-23 (default: slides like a Nice-to-have unless its goal is at risk); at risk or slid twice
  gets one inline question next time they open Zeno, at most once a day: [Tomorrow] [Let it go].
- The full weighing replaces EP0006's simple turn rule (whose turn a long-term goal gets).

### Out of Scope

- Moving events on the main calendar: EP0010 (the plan moves quietly; a calendar event moves only with one tap,
  OQ-10).
- Notifications about missed work: never.

### Affected Personas

- **Daniel Okafor:** "Know the one thing that matters most right now, across all his tools."
- **Rosa Delgado:** "Forgiven: a missed night is simply moved, not counted against her."
- **Maya Torres (Primary):** "Canvas, her inbox and her calendar each show everything. She cannot tell what matters
  first."

## Acceptance Criteria (Epic Level)

- [ ] The pick weighs stakes and lead time, and its one line of why names the reason.
- [ ] A missed Deadline or Commitment moves to the next good slot with no message.
- [ ] A missed Nice-to-have slides with no message.
- [ ] A missed Step follows the rule Vi chose in OQ-23.
- [ ] Something at risk or slid twice gets one inline question on the next open, never a notification, at most once
      a day.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0011 | Grade weights come from Canvas; until then, the points Canvas already gives | Draft |
| EP0010 | Moving calendar events | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0010 | Epic | Supplies the moves that become [Moved] or [Postponed] events |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The weighing feels like a black box | Medium | Medium | The one line of why, every time |
| Quiet moves surprise people | Medium | Medium | Moves only by kind; the inline question for anything at risk |
| A bigger prompt costs more | Medium | Low | Weights computed in code where possible; PRD §5 cost target |

## Technical Considerations

### Architecture Impact

- The pick today: `openingPrompt` and `checkPick` in `src/lib/agent.ts`, `rulePick` in `src/lib/brief.ts`. New: stakes and
  lead time as data in the prompt, and a slid count per item.

## Sizing

**Size:** L

**Estimated Story Count:** 6

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-14: where the one line of why shows. Default: in Zeno's spoken or written line, not on the card. - Owner: Vi
- [ ] OQ-10: how moves reach the calendar. Default: the plan moves quietly; a calendar event Zeno created moves only
      with one tap, offered the next time they open Zeno (Meta's rules ask apps to confirm calendar writes); never
      the person's own events. - Owner: Vi
- [ ] OQ-23: what happens to a missed Step. Default: it slides like a Nice-to-have unless its goal is at risk, then it
      moves like a Deadline. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: a missed Step follows OQ-23; calendar moves take one tap (OQ-10); replaces EP0006's simple turn rule; #6 of 13 |
