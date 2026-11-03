# EP0015: Native iPhone app

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** XL
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #11 of 12
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** K3, K5, B7

## Summary

A SwiftUI iPhone app. The stopwatch lives on the lock screen as a Live Activity with a Done button; widgets show the
one card; Siri can start or finish a step. To get there, the server becomes API-first: the web app and the native apps
use the same API.

**Goal:** the one thing is always one glance away, even with the phone locked.

## Business Context

### Problem Statement

A web app cannot sit on the lock screen or in a widget. The moment someone locks their phone mid-step, Zeno is out of
sight. ([PRD section K](../prd.md#k-platforms))

**What the brief says (§9):** PWA now, native next: a SwiftUI iPhone app (lock-screen Live Activity stopwatch with a
Done button, widgets, Siri), then a Mac menu-bar companion from the same code. API-first server.

### Value Proposition

- **With it:** Done from the lock screen; the card on the home screen without opening anything.
- **Without it:** the PWA (EP0005) is the phone experience.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Steps finished from the lock screen or a widget | 0 | Watched, no target | Done source on each step |

## Scope

### In Scope

- API-first: the routes the web app uses, with a sign-in that works for a native app (tokens, not only cookies). (K5)
- The iPhone app: the card, Start, Focus with the stopwatch, Done. (K3)
- A Live Activity on the lock screen: the stopwatch and a Done button. (B7)
- Widgets with the one card; Siri to start and finish a step.

### Out of Scope

- An Android app: not asked.
- The Mac: EP0016.
- Plan mode on iPhone at first: the web version serves it.

### Affected Personas

- **Rosa Delgado:** her phone is her computer most days.
- **Maya Torres (Primary):** her phone is everywhere; the lock screen keeps the step in view.

## Acceptance Criteria (Epic Level)

- [ ] The web app and the iPhone app use the same API.
- [ ] Starting a step shows a lock-screen stopwatch; Done there finishes the step everywhere.
- [ ] A widget shows the current card and opens straight to it.
- [ ] Every trust rule holds on iPhone: private facts on the device, never sends mail, never does the work.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0005 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0001 | The stopwatch model the Live Activity mirrors | Draft |
| An Apple developer account and App Store review | To ship to people's phones | Not started |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0016 | Epic | The Mac companion shares this code |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The private vault must move to the iPhone safely | High | High | The iPhone keeps its own vault in the Keychain; the server still never stores private facts |
| App Store review time | Medium | Medium | TestFlight first |

## Technical Considerations

### Architecture Impact

- Token auth beside Auth.js cookies; the JSON routes under `src/app/api/*` become the public API.

## Sizing

**Size:** XL

**Estimated Story Count:** 12 or more

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] Voice on iPhone: Meta's transcription through the same relay, or Apple's on-device speech? Default: Meta's, as
      the hackathon chose, re-checked when this epic starts. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
