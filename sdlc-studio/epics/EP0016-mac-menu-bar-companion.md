# EP0016: Mac menu-bar companion

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** L
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #12 of 12
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** K4

## Summary

A Mac menu-bar companion built from the same SwiftUI code as the iPhone app: the one card in the menu bar, Start,
the stopwatch and Done, without opening a browser.

**Goal:** on a laptop, the one thing is one click away, next to the clock.

## Business Context

### Problem Statement

On a laptop, Zeno is a browser tab among many. The brief's long-term picture is "the quiet layer between all your
tools and your day": on the laptop, the phone's lock screen and the Mac's menu bar, always showing one thing.
([PRD section K](../prd.md#k-platforms))

**What the brief says (§9):** native next: the iPhone app, then a Mac menu-bar companion from the same code.

### Value Proposition

- **With it:** Daniel sees his one thing next to the clock all day.
- **Without it:** the tab or the installed web app (EP0005) serves the laptop.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Steps started from the menu bar | 0 | Watched, no target | Start source on each step |

## Scope

### In Scope

- A menu-bar item showing the current card and the running stopwatch.
- Start and Done from the menu; opening the full app for everything else.

### Out of Scope

- A full Mac app with Plan mode: the web app serves it.
- Windows: not asked.

### Affected Personas

- **Daniel Okafor:** his laptop is where he works all day.
- **Maya Torres (Primary):** the library laptop, sound off.

## Acceptance Criteria (Epic Level)

- [ ] The menu bar shows the current step and its stopwatch while focusing.
- [ ] Start and Done from the menu bar act at once and stay in step with the web and iPhone apps.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0015 | Epic | Draft | Claude |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| None | - | - |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The menu bar becomes a nag | Low | Medium | No badges or alerts; the quiet rules of EP0001 apply |

## Technical Considerations

### Architecture Impact

- Shares the SwiftUI code and the API of EP0015.

## Sizing

**Size:** L

**Estimated Story Count:** 5

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

None yet; this epic waits for EP0015.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
