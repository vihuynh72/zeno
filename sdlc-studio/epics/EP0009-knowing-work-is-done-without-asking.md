# EP0009: Knowing work is done without asking

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #7 of 13
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
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

- Done from Canvas: an assignment Zeno planned shows "submitted" → its step or goal is done. The token lives only in
  the browser that holds the Canvas link (H4), so Zeno sees a submission when that browser opens Zeno and syncs.
- Done from Gmail: a sent email to the expected person → the step "Email Prof Patel…" is done.
- The daily 5-second list at the person's daily moment (OQ-13), one tap per item; talk counts too.
- What is marked done is shown, with one tap to undo.
- Done from Google Docs and GitHub progress (the brief's "later Docs/GitHub progress → marked done"), as this epic's
  last story, once EP0014 reads those sources.

### Out of Scope

- Reading Google Docs and GitHub themselves: EP0014 adds them as sources; this epic owns marking work done from them.
- Done from the lock screen, widgets and the watch: EP0015.
- The DONE sound: US0012 (Nov 4) if Vi says yes, else EP0013.

### Affected Personas

- **Maya Torres (Primary):** submits in Canvas, and Zeno knows.
- **Daniel Okafor:** "Keep his promises to people (reviews, replies, follow-ups) without living in his inbox."

## Acceptance Criteria (Epic Level)

- [ ] A planned Canvas assignment that becomes "submitted" marks its step done, with no tap, on the next open in the
      browser that holds the Canvas link.
- [ ] A sent email to the expected person marks its email step done, with no tap.
- [ ] The daily list shows at most once a day, never before the card, takes about 5 seconds, and every item is one
      tap.
- [ ] Anything marked done from a source can be undone with one tap.
- [ ] Once EP0014 reads them, progress in a planned Google Doc or GitHub issue marks its step done the same way.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Gmail read access (already granted: `gmail.readonly`) | Sent mail is readable today | Live |
| Canvas submission status for planned assignments | Today's Canvas read lists unsubmitted work; only the browser holding the token can read it | Live, extend |
| EP0014 | Google Docs and GitHub as sources, for the last story | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0013 | Epic | The end-of-day recap reads what got done |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A false done (a draft, a placeholder submission) | Medium | Medium | Only "submitted" states and sent mail to the expected person; one-tap undo |
| The daily list feels like a nag | Medium | Medium | Once a day, 5 seconds, skippable, never before the card, never a notification |
| A Canvas submission is not seen for days (that browser stays closed) | Medium | Low | The step stays open until then; nudges never mention a Canvas item a sync that day did not show as open (EP0005) |

## Technical Considerations

### Architecture Impact

- A link from each step to its source (a Canvas assignment id, an expected recipient), set when Zeno plans it.

## Sizing

**Size:** M

**Estimated Story Count:** 6

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-13: when the daily list appears. Default: right after the day's first Done, skippable; never before the card
      (one card first, and the card on screen in 200 ms or less). - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: Canvas done is seen on the next open in the browser holding the link; Docs and GitHub done is this epic's last story, after EP0014; the daily list never comes before the card (OQ-13); #7 of 13 |
