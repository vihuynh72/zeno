# US0005: A Back line after time away from the tab

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/components/guided-day.tsx, src/components/day-view.tsx, src/components/day-flow.ts, src/components/day-flow.check.ts, src/app/preview/gallery.tsx
> **Epic:** EP0001
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to tell me where I was when I come back to its tab after drifting off
**So that** I pick the step back up without feeling caught or watched

## Context

### Persona Reference

**Maya Torres** (Primary): "She drifts to her phone for eight minutes." Experience goal: "Never judged or nagged."
[Full persona](../personas/maya-torres.md)

### Background

The brief: "No surveillance: no screen recording, no app tracking. Browsers require permission to know if someone is
idle, so Zeno uses only its own tab's visibility (no permission): when the person comes back to Zeno after being
away, the card greets them with the step and the time so far ('Back. 23 min on 'Outline claim 2'.')." PRD A5 and L2.

The line goes on the card, as the brief says ("the card greets them"): in the goal line's place, the same slot as the
check-in line (US0004; OQ-19, whose option is right under the card instead). `listenMeta` (`src/lib/listen-meta.ts`)
already ends a listening session when the tab is hidden; this story only adds the greeting.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| PRD principle 4, L2 | Privacy | Only Zeno's own tab visibility; no idle-detection permission, no screen or app tracking | `document` `visibilitychange` is the only signal |
| PRD §5 | Performance | Instant: no network call | Built from the step's saved `startedAt` in the browser |
| PRD OQ-7 | Product | Default: after 1 minute away | `BACK_AFTER_MS = 60_000` |

## Acceptance Criteria

### AC1: Back after a minute away, during Focus

- **Given** Focus on "Outline claim 2", started 23 minutes ago, and Zeno's tab hidden for 61 seconds or more
- **When** the tab is shown again
- **Then** the card's second rule (the goal line's place) reads "Back. 23 min on 'Outline claim 2'." at once, with no
  network call, and nothing is spoken
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

### AC2: A quick glance away shows nothing

- **Given** Focus and Zeno's tab hidden for less than 60 seconds
- **When** the tab is shown again
- **Then** the line does not change
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

### AC3: Only during Focus

- **Given** the ready card, the screen after Done, talk or the wrap screen
- **When** the tab comes back after any time away
- **Then** no "Back." line shows
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

### AC4: The line, worked out without the network

- **Given** the pure function `backLine(title, startedAt, now)` in src/components/day-flow.ts
- **When** it is called with "Outline claim 2", a start 23 min 40 s before `now`; then with a start 20 s before `now`;
  then with a start 75 minutes before `now`
- **Then** it returns "Back. 23 min on 'Outline claim 2'.", "Back. 1 min on 'Outline claim 2'." (never 0) and
  "Back. 75 min on 'Outline claim 2'."
- **Verify:** shell TZ=UTC node src/components/day-flow.check.ts
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

### AC5: Only the tab's own visibility, no permissions

- **Given** the code base
- **When** it is searched
- **Then** nothing uses the Idle Detection API or screen capture, and the greeting listens only to `document`
  `visibilitychange`
- **Verify:** shell ! grep -rqE "IdleDetector|getDisplayMedia" src
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

### AC6: Never over a conversation

- **Given** Focus with a question and its tap answers on screen, a Gmail draft open, or Zeno listening or thinking
- **When** the tab comes back after a minute or more
- **Then** the line on screen stays (no "Back." over it)
- **Caller:** the visibility effect in src/components/guided-day.tsx
- **Verified:** no

## Scope

### In Scope

- `BACK_AFTER_MS` and `backLine` in `src/components/day-flow.ts`, with checks.
- One effect in `src/components/guided-day.tsx` while the screen is Focus.
- The card slot in `src/components/day-view.tsx` that draws the line in place of the goal line (shared with US0004;
  whichever story ships first adds it).
- A `/preview?state=focus-back` sample in `src/app/preview/gallery.tsx`.

### Out of Scope

- Any signal from outside Zeno's tab (other apps, other tabs, idle time). Never.
- A spoken greeting: Focus stays silent (US0002).

## Technical Notes

- In `src/components/guided-day.tsx`: a `hiddenAt` ref; a `useEffect` active while `screen === "focus"` adds a
  `visibilitychange` listener on `document`. On `hidden`, store `Date.now()`. On `visible`, if
  `Date.now() - hiddenAt >= BACK_AFTER_MS` and the focus step has a `startedAt`, and AC6's conditions don't hold,
  sets the card's `note` to `backLine(step.title, step.startedAt, Date.now())` (the same slot as US0004's check-in,
  also written into the polite live region). Clear `hiddenAt` after.
- Minutes are whole minutes since the step's start, rounded down, at least 1.
- Side-by-side windows: if Zeno's tab stays visible while the person works in another window, no greeting. That is
  the rule ("its own tab's visibility"), not a bug.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The laptop slept for an hour | The tab was hidden, so on wake: "Back. N min on '…'." with the full time |
| Hidden and shown several times | Each return after 60 s or more updates the line |
| `startedAt` is null | No line |
| A very long title | The rule cuts the line with an ellipsis; the full title is on the card's first rule anyway |
| A title with quotes in it ("Read 'Hamlet' act 1") | Shown as is inside the quotes; no escaping problem in text |
| The step was finished on another device while away | The local step still shows; the next `/api/day` read corrects it (as today) |

## Test Scenarios

- [ ] `day-flow.check.ts` asserts the three `backLine` cases in AC4.
- [ ] The grep in AC5 passes.
- [ ] Chrome on production: start a step, switch to another tab for 70 s, come back: the line shows; 30 s away: no
      line; on the ready card: no line.
- [ ] `/preview?state=focus-back` at 1440x900 and 390 px, light and dark.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0004](US0004-one-quiet-check-in-line-at-that-minute.md) | Code | Shares the card slot for the line; whichever ships first adds it | Draft |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Greeting | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-7: how long away before "Back." shows? Default: 1 minute. - Owner: Vi
- [ ] OQ-19: where the line sits. Default: on the card, in the goal line's place; option: right under the card. -
      Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fix: the Back. line sits on the card in the goal line's place, sharing US0004's slot (OQ-19); day-view.tsx added to Affects |
