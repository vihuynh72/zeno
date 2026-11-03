# US0002: Focus stays silent

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/components/guided-day.tsx, src/components/day-flow.ts, src/components/day-flow.check.ts, src/app/preview/gallery.tsx
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
**I want** Zeno to say nothing out loud while I focus, unless I talk to it
**So that** nothing breaks my concentration once I have finally started

## Context

### Persona Reference

**Maya Torres** (Primary): "I know what to do, I just can't start." Once she starts, an interruption can cost her the
step. [Full persona](../personas/maya-torres.md)

### Background

Today, in `src/components/guided-day.tsx`:

- `enterFocus` speaks and shows `CHECKINS.start` ("Timer's on. Just five minutes." / "Timer's on. 10 minutes, one
  thing.").
- The `checkin` effect speaks and shows "Halfway there." at half time and "Time's up. Done, or stuck?" at the end.
- `headsUp` speaks "Heads up, <event> in N minutes." for timed events starting within 10 minutes, checked every 20 s,
  Focus included.

The brief: check-ins are "VISUAL ONLY (Vi chose 'even quieter'): a soft line on the card; no spoken line, no
notifications." The PRD: "The spoken start, halfway and end lines go away. During focus Zeno says nothing out loud
(spoken heads-ups before events: OQ-6)."

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §2 | Product | No alarm, no spoken check-in, no notification | No sound from a timer during Focus |
| PRD OQ-6 | Product | Default: heads-ups stay for timed events, never during Focus | Heads-ups wait until Focus ends |
| PRD principle 1 | Design | One big button; taps act at once | Start still starts the timer at the tap |

## Acceptance Criteria

### AC1: No start line

- **Given** the ready card with Sound on
- **When** Maya taps Start
- **Then** the stopwatch starts at once, Zeno says nothing, and the line under the card is empty (no "Timer's on…")
- **Verify:** shell ! grep -rqF "Timer's on" src
- **Caller:** `enterFocus` in src/components/guided-day.tsx
- **Verified:** no

### AC2: No halfway or end lines

- **Given** Focus on a 10-minute step, Sound on
- **When** minute 5 and minute 10 pass
- **Then** nothing is spoken or shown; `CHECKINS` and the half and end timers are gone from the code
- **Verify:** shell ! grep -rq "CHECKINS" src
- **Caller:** the Focus effects in src/components/guided-day.tsx
- **Verified:** no

### AC3: No heads-up during Focus; it comes after, if still ahead

- **Given** Focus, Sound on, and a timed event starting in 8 minutes that has not had its heads-up
- **When** the 20-second heads-up check runs during Focus
- **Then** nothing is spoken and the event is not marked as warned; and when Focus ends (Done, Stop for now) while the
  event is still ahead, the next check says the heads-up once, as today
- **Caller:** `headsUp` in src/components/guided-day.tsx
- **Verified:** no

### AC4: Zeno still answers when spoken to

- **Given** Focus, Sound on
- **When** Maya taps Talk or Stuck? and asks something
- **Then** Zeno answers out loud as today
- **Caller:** `onUserTurn` in src/components/guided-day.tsx
- **Verified:** no

### AC5: After Done, Zeno speaks as today

- **Given** Focus, Sound on
- **When** Maya taps Done
- **Then** "Nice. Next: <step>, N min" is spoken as today (it is after Focus)
- **Caller:** `finishStep` in src/components/guided-day.tsx
- **Verified:** no

## Scope

### In Scope

- `enterFocus`: no start line, spoken or shown.
- Remove the `checkin` effect event and its half and end timers, and `CHECKINS` in `src/components/day-flow.ts`.
- `headsUp`: return early while the screen is Focus, without marking the event as warned.
- The `/preview` gallery's Focus samples lose their "Timer's on…" lines, and `day-flow.check.ts` stops using that
  sentence (its `asks` example takes another one).

### Out of Scope

- The new quiet check-in line: US0004.
- Heads-ups outside Focus: unchanged (OQ-6 default).

## Technical Notes

- `src/components/guided-day.tsx`: `enterFocus` sets the line to "" and calls no `speakLine`; remove
  `const checkin = useEffectEvent(...)` and the `useEffect` that schedules `["half", "end"]`; in `headsUp`, add
  `if (latest.current.screen === "focus") return;` before `warned.current.add(...)`.
- `src/components/day-flow.ts`: delete `CHECKINS`; `src/components/day-flow.check.ts`: delete the three
  `CHECKINS.start` asserts and change `asks("Timer's on. Just five minutes.")` to another statement.
- `src/app/preview/gallery.tsx`: the `focus`, `focus-email`, `focus-canvas` and `focus-sources` samples set
  `line: ""`. There is a `hands-free` listening sample already (used by US0007).
- The old `zeno:checkins` mute key has been unread since Nov 2 (HANDOFF known issue); nothing to migrate.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Sound off | No difference: nothing is spoken either way |
| An event warned before Focus started | Not repeated |
| An event that starts and ends during Focus | Never said (the person was focusing) |
| Two events ahead when Focus ends | Each gets its heads-up once, at the next checks, as today |
| Zeno is mid-answer when Focus starts | The answer finishes; nothing new is added |
| Focus ends by saying "done" in talk | The usual Done screen and line |

## Test Scenarios

- [ ] `TZ=UTC node src/components/day-flow.check.ts` passes without `CHECKINS`.
- [ ] Both greps in AC1 and AC2 pass.
- [ ] Chrome, Sound on: a 2-minute step makes no sound from Start to Done.
- [ ] Chrome, Sound on: with an event 8 minutes ahead, Focus is silent; after Stop for now the heads-up is said once.

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
| Focus sounds | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-6: keep spoken heads-ups outside Focus, or drop them? Default: keep, never during Focus. Dropping them means
      deleting `headsUp`. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
