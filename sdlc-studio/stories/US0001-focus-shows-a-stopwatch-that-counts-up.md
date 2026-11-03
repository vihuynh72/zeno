# US0001: Focus shows a stopwatch that counts up

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/components/day-view.tsx, src/components/day-flow.ts, src/components/day-flow.check.ts
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
**I want** the Focus timer to count up from when I started, with the planned time shown softly beside it
**So that** a long step never feels like failing, and nothing goes off when the planned time passes

## Context

### Persona Reference

**Maya Torres** (Primary): a college junior with ADHD. "Timers that beep and apps that ping make her anxious, so she
mutes them and then misses things." [Full persona](../personas/maya-torres.md)

### Background

Today `Countdown` in `src/components/day-view.tsx` shows `clock(left)`: it counts down from the step's minutes
(`props.timer ?? top.minutes`) and stops at 0:00. The brief: "Replace the countdown with a stopwatch counting up.
Muse sets each step's time (shown softly as the planned time). 'I don't want any alarm… It's annoying.'"

Code as of `main` at `7adcddb`: the Focus card has three rules (the step's title, its goal line, the timer).

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Epic | Design | Times in Atkinson Hyperlegible Mono (DESIGN.md "Mono Counts Rule") | "7:12" and "of 25 min" use the Mono |
| PRD §5 | Accessibility | No alarms, no flashing, no countdown pressure | Nothing changes at the planned time |
| CLAUDE.md | Platform | The server runs in UTC; dates through `src/lib/tz.ts` | The stopwatch uses elapsed milliseconds only, no time zone |

## Acceptance Criteria

### AC1: The time counts up from the step's saved start

- **Given** Focus on a step whose `startedAt` is 7 minutes 12 seconds ago and whose planned time is 25 minutes
- **When** the Focus card renders
- **Then** the timer reads `7:12` in the existing `.timer` style, and beside it, in Pencil Grey (`text-ink-2`) and the
  Mono at body size, `of 25 min`; one second later it reads `7:13` (checked in the browser; the formatter itself
  is AC4)
- **Caller:** the `Stopwatch` component in src/components/day-view.tsx, which replaces `Countdown`
- **Verified:** no

### AC2: Nothing happens when the planned time passes

- **Given** a 25-minute step started 25 minutes ago, Sound on
- **When** 6 more minutes pass
- **Then** the timer reads `31:00`, `of 25 min` stays as it was, and nothing else changes: no sound, no spoken line, no
  color change, no new button
- **Caller:** the Focus card in src/components/day-view.tsx
- **Verified:** no

### AC3: A reload keeps the running time

- **Given** Focus running at about 7:12 on production
- **When** the page reloads
- **Then** the timer shows about 7:13 within a second (from the saved day, then `/api/day`), never 0:00
- **Caller:** `GuidedDay` (src/components/guided-day.tsx) passes the saved goal's `startedAt` to the card
- **Verified:** no

### AC4: The time format, past an hour and at the edges

- **Given** the pure formatter `elapsed(seconds)` in src/components/day-flow.ts
- **When** it is called with 0, 59, 60, 432, 3599, 3600, 3725 and -3
- **Then** it returns `0:00`, `0:59`, `1:00`, `7:12`, `59:59`, `1:00:00`, `1:02:05` and `0:00` (whole seconds,
  rounded down; never negative)
- **Verify:** shell TZ=UTC node src/components/day-flow.check.ts
- **Caller:** the `Stopwatch` component in src/components/day-view.tsx
- **Verified:** no

### AC5: A step with no planned time still shows the stopwatch

- **Given** Focus on a step whose `minutes` is null
- **When** the card renders
- **Then** the stopwatch shows the elapsed time alone, with no "of … min"
- **Caller:** the Focus card in src/components/day-view.tsx
- **Verified:** no

### AC6: Screen readers hear it once, not every second

- **Given** a screen reader on the Focus card
- **When** it reaches the timer
- **Then** it reads the time followed by "so far, of 25 minutes planned" (screen-reader-only text), and the timer is
  not a live region, so it is never announced on each tick
- **Caller:** the `Stopwatch` component in src/components/day-view.tsx
- **Verified:** no

## Scope

### In Scope

- `Stopwatch` replacing `Countdown` in `src/components/day-view.tsx`.
- `elapsed(seconds)` replacing `clock(seconds)` in `src/components/day-flow.ts`, with its checks.

### Out of Scope

- Removing the spoken lines: US0002.
- The check-in line: US0004.
- Any server change: `startedAt` is already saved on Start (`changeStepStatus` sets `started_at = now()`), and the
  draft plan sets it at the tap (`draftGoal`).

## Technical Notes

- `Stopwatch({ minutes, startedAt })` uses the existing `useNow()` (a once-a-second wall clock, `0` on the server so
  the first paint matches). Elapsed seconds: `max(0, (now - Date.parse(startedAt)) / 1000)`; `0` before the browser's
  clock or when `startedAt` is null.
- Planned minutes stay `props.timer ?? top.minutes` (the minutes the Start tap showed, so a rule pick that cut a long
  step to 5 shows `of 5 min`).
- Show the timer row for every Focus step (today it hides when `top.minutes` is null).
- `clock` has no callers besides `Countdown` and its three checks (`git grep "clock("`), so it is replaced, not kept.
- Keep the existing screen-reader pattern: visible text, plus a `sr-only` span, no `aria-live`.

### Data Requirements

None. No new fields.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| `startedAt` is null | `0:00` (and `of N min` when sized) |
| `startedAt` is in the future (the device clock is behind) | `0:00`, never negative |
| Server render and first paint | `0:00` from `useNow()`'s server value, then the live time; no hydration mismatch, as today |
| The tab was in the background for 10 minutes | On return the time jumps to the true elapsed time (wall clock, no drift) |
| A step left running for more than a day | `25:03:10` style (hours keep counting) |
| A rule pick cut a 90-minute step to 5 | `of 5 min`, the minutes the Start tap said |
| Reduced motion | No change: nothing animates |

## Test Scenarios

- [ ] `day-flow.check.ts` asserts the eight `elapsed` cases in AC4 (the old `clock` asserts go).
- [ ] `/preview?state=focus` at 1440x900 and 390 px wide, light and dark: the time and `of 10 min` fit on one rule.
- [ ] Production: start a 1-minute step, wait to 1:30: nothing happens; reload: the time carries on.
- [ ] VoiceOver on the Focus card reads the time and "so far, of N minutes planned" once.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Focus card | Revert the merge commit on `main`; Vercel redeploys (or Instant Rollback in Vercel) | About 2 minutes |

## Open Questions

None. "of 25 min" is the PRD's wording.

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
