# EP0001: Quiet focus: stopwatch, one check-in and Back

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Nov 4, must ship (demo shot 4)
> **Target Release:** Nov 4 demo, on production before the Nov 3 reset (2 PM PT, DQ-1); after that only as a fix
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** A3, A4, A5, L2, and the Nov 4 slice of A6

## Summary

Focus becomes quiet. The timer counts up instead of down, so a step never "runs out". Each step gets one soft
check-in line on the card, at a minute Muse picks for that task. When you come back to Zeno's tab after a while away,
the card says where you were: "Back. 23 min on 'Outline claim 2'." Zeno says nothing out loud while you focus, unless
you talk to it.

**Goal:** Maya starts a step and stays with it. No alarm, no pings, no questions to answer.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD §5 | Performance | The return greeting is instant: no network call | Worked out in the browser from the step's saved start |
| PRD principle 4, L2 | Privacy | Only Zeno's own tab visibility. No idle-detection permission, no screen or app tracking | `visibilitychange` on `document` is the only signal |
| PRD §5 | Accessibility | No alarms, no flashing, no countdown pressure | The lines are plain text; nothing beeps or blinks |
| DESIGN.md | Design | Times and minute counts in Atkinson Hyperlegible Mono; one big button per screen | "7:12" and "of 25 min" in Mono; no new buttons |
| PRD §5 | AI cost | New judgments ride on calls Zeno already makes | The check-in minute comes with the steps; no new model call |

## Business Context

### Problem Statement

Today Focus counts down from the step's minutes and speaks three lines: "Timer's on. Just five minutes.", "Halfway
there." and "Time's up. Done, or stuck?". A countdown that hits 0:00 feels like failing, and the spoken lines break
concentration. ([PRD section A](../prd.md#a-do-mode-and-focus))

**What Vi said:** "I don't want any alarm… It's annoying." Check-ins are "heavily depending on the task… it's got to
learn from the user over time". "I don't want people having to write something or checking in every 5-10 minutes… I
want to help people think better and focus more." Vi chose check-ins that are "even quieter": visual only.

### Value Proposition

- **With it:** Maya can drift off, come back and pick up where she was. A long step is just a long step.
- **Without it:** the demo's focus moment (shot 4) shows a countdown and spoken lines Vi called annoying.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Lines Zeno speaks during a step, when nobody talks to it | 2 to 3 | 0 | A run on production with Sound on |
| New steps that carry a check-in minute from Muse | 0% | 90% or more | SQL: share of steps created after release with `checkin` set |
| Finished steps per day with at least one finished step (O1's stand-in until EP0005's daily "opened" mark exists) | Not measured | 2 or more (proposed, OQ-15) | `steps.done_at`, per person, in their time zone |

## Scope

### In Scope

- A stopwatch that counts up from the step's saved start, with the planned time in grey: "7:12 of 25 min". (A3)
- No sound in Focus: no spoken start, halfway or end line, and no spoken heads-up while focusing. (A3, A4, OQ-6
  default)
- One check-in minute per step, picked by Muse when it writes the steps. Muse sees the patterns Zeno already learns
  from use (real step lengths, time of day), which is the Nov 4 version of "learned per person". (A4, OQ-12 default)
- One soft check-in line at that minute, on the card: it takes the goal line's rule while it shows (OQ-19 default).
  Visual only, shown once, never needs an answer. (A4)
- "Back. N min on '<step>'." on the card, in the same place, after 1 minute or more away from Zeno's tab, during
  Focus only. (A5, L2)
- The `/preview` gallery shows the new looks.

### Out of Scope

- A check-in that adapts from how the person responds to it (the deeper A6). Later, in EP0013: it learns from how
  steps go after the line shows (finished soon after, or ran far past), from the times Zeno already saves; Zeno never
  asks.
- Going back into Focus after a reload or a closed tab. For Nov 4 a reload shows the card, as today, and Start
  restarts the stopwatch (Start saves a new start time). Later, in EP0005 (OQ-22).
- Any notification, sound or vibration for a check-in. Never (brief §2).
- Idle detection, screen recording or app tracking. Never (L2).
- The lock-screen stopwatch on iPhone. Later, EP0015.

### Affected Personas

- **Maya Torres (Primary):** the demo's focus moment. Her frustration: "Timers that beep and apps that ping make her
  anxious, so she mutes them and then misses things."
- **Rosa Delgado:** works in small windows and gets interrupted; "Back." tells her where she was.
- **Daniel Okafor:** deep work without pings.

## Acceptance Criteria (Epic Level)

- [ ] Focus shows a stopwatch counting up, with the planned time in grey. Nothing happens when the planned time
      passes.
- [ ] A reload during Focus shows the card, as today; Start then restarts the stopwatch from 0:00.
- [ ] Zeno says nothing out loud during Focus unless the person talks to it.
- [ ] Each new step carries a check-in minute from Muse; a step without one uses a default minute.
- [ ] One soft line shows on the card at the check-in minute, once, and never needs an answer.
- [ ] After 1 minute or more away from Zeno's tab during Focus, the card reads "Back. N min on '<step>'."
- [ ] Zeno uses only its own tab's visibility. It asks for no permission to do it.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Vi's answers: OQ-6, OQ-7, OQ-19 (where both lines sit, and the check-in's words), the default minute | The stories use the defaults until Vi answers | Open |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0004 (US0015, US0016) | Epic | The release check and the recording of shot 4 wait for this epic |
| EP0013 | Epic | The check-in that adapts per person builds on the minute stored here |
| EP0015 | Epic | The iPhone lock-screen stopwatch reuses this stopwatch |

## Risks & Assumptions

### Assumptions

- Muse can pick a sensible minute in the same call that writes the steps, with no new call and almost no cost.
- Browsers fire `visibilitychange` when a tab is switched away and back. All current browsers do.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Muse leaves the minute out or picks nonsense | Medium | Low | Only a whole number from 1 to the planned minutes minus 1 is kept; otherwise the default minute |
| Background tabs slow timers, so the line shows late | Medium | Low | The minute is measured from the saved start; a moment already passed is not shown late |
| A new field on steps breaks checks that compare whole steps | High | Low | US0003 updates those checks in the same change |
| The line on the card hides the goal line while it shows | Medium | Low | The goal line comes back with the next step; OQ-19 offers "right under the card" instead, a small markup change |
| 14 points in this epic before the Nov 3 reset (2 PM PT, DQ-1) | Medium | High | All five stories are in what the video needs (brief §2: Muse picks the minute "per task"); the default minute is only the fallback when Muse leaves one out. Cut order for the rest of Nov 4 in the [epic index](_index.md) |

## Technical Considerations

### Architecture Impact

- One new nullable column, `steps.checkin INT`, added the way the schema always grows: `ALTER TABLE … ADD COLUMN IF
  NOT EXISTS` in `ensureSchema` (`src/lib/db.ts`).
- `Step.checkin` and `NewStep.checkin`; a `checkin` field in the `set_goal` and `update_steps` tool steps and in the
  opening's `PLAN_STEP` (`src/lib/agent.ts`).
- The rest is in the browser: the stopwatch and the card's line in the goal line's place
  (`src/components/day-view.tsx`), the line's timer and the visibility listener (`src/components/guided-day.tsx`), pure
  helpers with self-checks (`src/components/day-flow.ts`).
- Written against `main` at `7adcddb` (the tidy round, Nov 2 11:43 PM): the Focus card already holds three rules
  (title, goal line, timer).

### Integration Points

- Muse (`muse-spark-1.3`, `reasoning_effort: "minimal"`): the minute is part of the talk and opening calls.
- Neon Postgres: one new column.

## Sizing

**Size:** M

**Estimated Story Count:** 5

**Derived Point Total:** 14

**Complexity Factors:**

- Touches the Focus screen, the tool schemas and the database in one epic.
- Timers that must behave in background tabs and after reloads.

## Story Breakdown

- [ ] [US0001: Focus shows a stopwatch that counts up](../stories/US0001-focus-shows-a-stopwatch-that-counts-up.md)
- [ ] [US0002: Focus stays silent](../stories/US0002-focus-stays-silent.md)
- [ ] [US0003: Each step gets a check-in minute that Muse picks](../stories/US0003-each-step-gets-a-check-in-minute-that.md)
- [ ] [US0004: One quiet check-in line at that minute](../stories/US0004-one-quiet-check-in-line-at-that-minute.md)
- [ ] [US0005: A Back line after time away from the tab](../stories/US0005-a-back-line-after-time-away-from-the.md)

## Test Plan

- Self-checks: `TZ=UTC node src/components/day-flow.check.ts`, `node src/lib/agent.check.ts`, and
  `node --env-file=.env.local src/lib/goals.check.ts` (a throwaway database user it deletes after).
- A manual run in Chrome: `/preview` at 1440x900 and 390 px wide, light and dark; then production.
- No test-spec file yet. The skill wants one before this epic is Done (`verify_ac epic-ts`).

## Open Questions

- [ ] OQ-6: keep spoken heads-ups before events outside Focus? Default: yes, for timed events, never during Focus. -
      Owner: Vi
- [ ] OQ-7: how long away before "Back." shows? Default: 1 minute. - Owner: Vi
- [ ] OQ-19: where the check-in and "Back." lines sit, and the check-in's words. Default: on the card, as the brief
      says, in the goal line's place while the line shows (the card's three rules are full and the short-laptop
      layout has no fourth); words "Still with it? Keep going." Option: right under the card. - Owner: Vi
- [ ] The minute when Muse gives none. Default: 80% of the planned time (minute 20 of 25), and no line for steps
      under 4 minutes. - Owner: Vi
- [ ] Is "learned per person" for Nov 4 enough as: Muse sees the patterns Zeno already learns when it picks the
      minute (OQ-12 default)? - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief and the code at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: both lines sit on the card (OQ-19 default, the brief's words); a reload shows the card as today (resuming is Later, OQ-22); O1 counted per day with a finished step; US0003 is in what the video needs; reset-time target |
