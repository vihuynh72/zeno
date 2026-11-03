# US0004: One quiet check-in line at that minute

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/components/guided-day.tsx, src/components/day-flow.ts, src/components/day-flow.check.ts, src/app/preview/gallery.tsx
> **Epic:** EP0001
> **Points:** 3
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** one soft line to appear at the step's check-in minute and then leave me alone
**So that** I get a gentle push to keep going without having to answer anything

## Context

### Persona Reference

**Maya Torres** (Primary): "At minute 11 a soft line appears on the card: 'Still with the outline? Keep going.' She
does not answer, and nothing else happens." (her scenario) [Full persona](../personas/maya-torres.md)

### Background

The brief: "Check-ins are VISUAL ONLY (Vi chose 'even quieter'): a soft line on the card; no spoken line, no
notifications. Never needs an answer." "No answer to a check-in: keep counting quietly. A step running long: say
nothing, keep counting." US0002 removes the old spoken half and end lines; US0003 stores Muse's minute on each step.

During Focus, Zeno's line shows right under the card (the `caption` block in `src/components/day-view.tsx`, through
`Said`, which fades a new line in). The card itself is full: its three rules hold the title, the goal line and the
stopwatch, and the short-laptop layout has no fourth.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §2 | Product | Visual only; never needs an answer; no notification | No sound, no button, no question to answer |
| PRD §5 | Accessibility | A screen reader can find the line; it never interrupts | The line goes through the polite live region, like every Zeno line |
| PRD OQ-12 | Product | No new tracking | The default minute uses only the planned time |

## Acceptance Criteria

### AC1: The line shows once, at the minute

- **Given** Focus on a step started at 9:00 with `checkin: 20`
- **When** 9:20 comes, with Zeno's tab visible or hidden
- **Then** the line under the card reads "Still with it? Keep going." (default words, an open question for Vi), fading
  in like Zeno's other lines; it is not spoken, not a notification, carries no button, and shows once per start of
  the step
- **Caller:** the check-in effect in src/components/guided-day.tsx
- **Verified:** no

### AC2: The minute, with a default when Muse gave none

- **Given** the pure function `checkinAt(planned, saved)` in src/components/day-flow.ts, where `planned` is the minutes
  the Start tap said (`timer ?? step.minutes`) and `saved` is `step.checkin`
- **When** it is called with (25, 20), (25, null), (10, null), (5, null), (5, 12), (3, null), (null, null) and (25, 25)
- **Then** it returns 20, 20, 8, 4, 4, null, null and 20: `saved` when `1 <= saved <= planned - 1`, otherwise
  `round(planned * 0.8)` when `planned >= 4`, otherwise null (no line for steps under 4 minutes)
- **Verify:** shell TZ=UTC node src/components/day-flow.check.ts
- **Caller:** the check-in effect in src/components/guided-day.tsx
- **Verified:** no

### AC3: Never late, never over a conversation

- **Given** Focus with a check-in minute
- **When** the minute passed while the page was closed or reloading, or at the minute Maya is talking (listening or
  thinking), a question with tap answers is on screen, or a Gmail draft is open
- **Then** the line is not shown (and not shown later)
- **Caller:** the check-in effect in src/components/guided-day.tsx
- **Verified:** no

### AC4: Ignoring it changes nothing

- **Given** the check-in line on screen
- **When** Maya does nothing
- **Then** the stopwatch keeps counting, the line stays until the next line replaces it (a reply, "Back.", Done), and
  nothing else happens
- **Caller:** the Focus screen in src/components/day-view.tsx
- **Verified:** no

### AC5: The draft plan carries the minute

- **Given** a first-card pick whose steps carry `checkin` (US0003)
- **When** Start shows the draft plan at once (`draftGoal(pick, now)`)
- **Then** each draft step has the pick's `checkin`, or null
- **Verify:** shell TZ=UTC node src/components/day-flow.check.ts
- **Caller:** `startPick` in src/components/guided-day.tsx
- **Verified:** no

## Scope

### In Scope

- `CHECKIN_LINE`, `checkinAt` and `draftGoal`'s `checkin` in `src/components/day-flow.ts`, with checks.
- One effect in `src/components/guided-day.tsx` that sets the line at the minute.
- A `/preview?state=focus-checkin` sample in `src/app/preview/gallery.tsx`.

### Out of Scope

- Saving the minute: US0003. (This story works without it: the default minute applies.)
- Removing the old spoken lines: US0002.
- A line that adapts from how people respond: Later, EP0013.

## Technical Notes

- `src/components/guided-day.tsx`: next to `focusStep` and `focusMinutes`, a `useEffect` keyed on the focus step's id,
  `startedAt`, `checkin` and `focusMinutes`: `at = Date.parse(startedAt) + checkinAt(focusMinutes, checkin) * 60_000`;
  if `at > Date.now()`, a `setTimeout` calls a `useEffectEvent` that checks `latest.current.screen === "focus"`, no
  `options`, no `draft`, and `voice.phase` not `"listening"` or `"thinking"`, then `setLine(CHECKIN_LINE)`. Cleanup
  clears the timer, so Done, Stop for now and a new step cancel it.
- Background tabs may run the timer late (browsers slow hidden-tab timers). Inside the callback, skip if
  `Date.now() - at > 60_000`, so a very late timer never shows a stale line.
- `setLine` already feeds the polite live region (`aria-live="polite"` in `day-view.tsx`), which never interrupts.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Two steps in a row (Keep going) | Each start gets its own line at its own minute |
| Stop for now before the minute | No line (the timer is cleared) |
| The step was started again (Start restarts its timer) | The minute counts from the new start |
| Sound off | No difference: the line is never spoken |
| A hidden tab whose timer fires 3 minutes late | Skipped (over 60 s late) |
| A rule pick cut a 90-minute step to 5 (`timer` 5, saved `checkin` 60) | `checkinAt(5, 60)` gives 4: minute 4 |
| The draft's ids swap for the saved plan's | The effect re-keys on the real step; the minute is the same |
| A reload during a step the rule pick cut to 5 minutes | The tap's 5 is gone after a reload, so the planned time falls back to the saved minutes (today's timer does the same; HANDOFF known issue "a fallback card can disagree on minutes") |

## Test Scenarios

- [ ] `day-flow.check.ts` asserts the eight `checkinAt` cases in AC2 and `draftGoal` carrying `checkin`.
- [ ] `/preview?state=focus-checkin` at 1440x900 and 390 px, light and dark: the line fits under the card.
- [ ] Chrome: a 5-minute step shows the line at minute 4, once, silently; ignoring it changes nothing.
- [ ] Chrome: talking at the minute keeps the conversation on screen; no line appears.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0002](US0002-focus-stays-silent.md) | Code | The old half and end timers are gone, so this is the one Focus line | Draft |
| [US0003](US0003-each-step-gets-a-check-in-minute-that.md) | Data | `Step.checkin` from Muse (without it, the default minute applies) | Draft |

## Estimation

**Points:** 3
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Focus line | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] The words. Default: "Still with it? Keep going." - Owner: Vi
- [ ] Where it sits. Default: right under the card, where Focus already shows Zeno's words. - Owner: Vi
- [ ] The default minute when Muse gives none. Default: 80% of the planned time; none under 4 minutes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
