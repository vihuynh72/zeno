# EP0009: Knowing work is done without asking

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #5 of 12
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** B5, B6; OQ-13

## Summary

Zeno knows work is done without being told. When Canvas shows an assignment "submitted", or a sent Gmail reached the
right person, the step or goal is marked done with no tap (later: Google Docs and GitHub progress). Once a day, at the
person's daily moment, a 5-second list asks "Did these get done?" with one tap per item. Saying "finished the outline"
already counts.

**Goal:** Zeno always knows where the person is, and coming back feels good, without nudging.

## Business Context

### Problem Statement

Today a step is done only when someone taps Done or says so. Work finished elsewhere (submitted in Canvas, an email
sent from Gmail) stays open in Zeno, so the card can show work that is already finished.
([PRD section B](../prd.md#b-knowing-work-is-done))

**What Vi said:** "I want to make sure there's a way for users to keep coming back to Zeno… whenever they complete a
part of a task. We don't want to nudge them all the time." (All four ways were Claude's proposal; Vi accepted them.)

### Value Proposition

- **With it:** the card never asks you to do what you already did; the goal's bar moves on its own.
- **Without it:** people have to report back to Zeno, which is the managing Zeno promises to remove.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Steps marked done from a source | 0 | Proposed with Vi | Steps whose done came from Canvas or Gmail |
| Daily list answered | Not possible | Proposed with Vi | Taps on the list against lists shown |

## Scope

### In Scope

- Done from Canvas: an assignment Zeno planned shows "submitted" → its step or goal is done.
- Done from Gmail: a sent email to the expected person → the step "Email Prof Patel…" is done.
- The daily 5-second list at the person's daily moment (OQ-13), one tap per item; talk counts too.
- What is marked done is shown, with one tap to undo.

### Out of Scope

- Google Docs and GitHub progress: with EP0014's sources.
- Done from the lock screen, widgets and the watch: EP0015.
- The DONE sound: US0012 (Nov 4) if Vi says yes, else EP0013.

### Affected Personas

- **Maya Torres (Primary):** submits in Canvas, and Zeno knows.
- **Daniel Okafor:** "Keep his promises to people (reviews, replies, follow-ups) without living in his inbox."

## Acceptance Criteria (Epic Level)

- [ ] A planned Canvas assignment that becomes "submitted" marks its step done within a day, with no tap.
- [ ] A sent email to the expected person marks its email step done, with no tap.
- [ ] The daily list shows at most once a day, takes about 5 seconds, and every item is one tap.
- [ ] Anything marked done from a source can be undone with one tap.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Gmail read access (already granted: `gmail.readonly`) | Sent mail is readable today | Live |
| Canvas submission status for planned assignments | Today's Canvas read lists unsubmitted work | Live, extend |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0013 | Epic | The end-of-day recap reads what got done |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A false done (a draft, a placeholder submission) | Medium | Medium | Only "submitted" states and sent mail to the expected person; one-tap undo |
| The daily list feels like a nag | Medium | Medium | Once a day, 5 seconds, skippable, never a notification |

## Technical Considerations

### Architecture Impact

- A link from each step to its source (a Canvas assignment id, an expected recipient), set when Zeno plans it.

## Sizing

**Size:** M

**Estimated Story Count:** 5

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-13: when the daily list appears. Default: the first open of the day, before the card. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
