# US0003: Each step gets a check-in minute that Muse picks

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/db.ts, src/lib/day.ts, src/lib/goals.ts, src/lib/agent.ts, src/lib/agent.check.ts, src/lib/goals.check.ts
> **Epic:** EP0001
> **Points:** 5
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** each step to carry the minute when a quiet check-in fits that task, picked from how I actually work
**So that** the check-in comes at a useful moment for this step, not on a fixed clock

## Context

### Persona Reference

**Maya Torres** (Primary): her steps often take longer than planned; a check-in at the planned halfway would come too
early. [Full persona](../personas/maya-torres.md)

### Background

The brief: "One check-in moment per step, chosen by Muse per task and learned per person over time ('It's heavily
depending on the task… it's got to learn from the user over time')." The PRD splits it: A4 (Nov 4, Muse picks per
task) and A6 (Later, adapts per person), with OQ-12's default: "only what Zeno already learns (real step lengths,
time of day). No new tracking."

The Nov 4 version: Muse picks the minute in the same call that writes the steps. Its system prompt already lists the
"Patterns you noticed in what they did" (for example "Steps take you about 1.5x as long as you plan."), from
`learnFromSteps` in `src/lib/patterns.ts`. So the pick already reflects this person. No new model call.

Where steps are written today (all in `src/lib/agent.ts` unless noted):

- Talk: the `set_goal` and `update_steps` tools (`stepFields`), checked by `checkCall` → `stepsOf`, saved by `setGoal`
  or `replaceRemainingSteps` in `src/lib/goals.ts`.
- The opening's new plan: `OPENING_SCHEMA` → `PLAN_STEP` (strict JSON), checked by `checkPick` → `checkPlan`; the
  card's Start saves it through `POST /api/goal` (`src/app/api/goal/route.ts`, `checkPlan` again) → `setGoal`.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| PRD §5 | AI cost | New judgments ride on calls Zeno already makes | No new model call; one more small field per step |
| CLAUDE.md | Muse | Always set `reasoning_effort` | Unchanged: `"minimal"` for talk and the opening |
| PRD §5 | Security | Model output is untrusted; check every argument at the boundary | A bad minute becomes null; it never fails the plan |
| PRD §7 | Data | Schema grows additively in `ensureSchema` | `ALTER TABLE steps ADD COLUMN IF NOT EXISTS checkin INT` |

## Acceptance Criteria

### AC1: Talk's tools take a check-in minute

- **Given** talk, and Muse calling `set_goal` with a step `{ title: "Outline claim 2", minutes: 25, checkin: 20 }`
- **When** `checkCall` checks it
- **Then** it returns that step with `checkin: 20` (saving it is AC4); the same holds for `update_steps`, where a
  kept step (by ref) takes the `checkin` given in the call, as it does its minutes
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `talk()` in src/lib/agent.ts, through `setGoal` and `replaceRemainingSteps` in src/lib/goals.ts
- **Verified:** no

### AC2: A bad minute is dropped, never the plan

- **Given** a step with `minutes: 10` and a `checkin` of 0, 10, 12, 2.5, "5", -1 or no `checkin` at all
- **When** `checkCall` (talk) or `checkPlan` (`POST /api/goal` and the opening pick) checks it
- **Then** the step is accepted with `checkin: null`; only a whole number from 1 to `minutes - 1` is kept, and a step
  whose `minutes` is null always gets `checkin: null`
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `checkCall` and `checkPlan` in src/lib/agent.ts
- **Verified:** no

### AC3: The opening's new plan carries it to the saved plan

- **Given** `PLAN_STEP` in `OPENING_SCHEMA` with `checkin` as a required integer (strict JSON schemas need every field;
  0 means none)
- **When** Muse plans a new deadline and the person taps Start on the card
- **Then** `checkPick` keeps each valid `checkin` (0 becomes null) in `pick.steps`, and `POST /api/goal` saves it with
  each step
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `POST /api/day/opening` (src/app/api/day/opening/route.ts) and `savePick` in src/components/guided-day.tsx
- **Verified:** no

### AC4: It is stored and read back

- **Given** `ensureSchema` has run
- **When** a plan is saved and read back with `setGoal`, `replaceRemainingSteps` and `currentGoal`
- **Then** each step has `checkin` as saved, or null; rows saved before this change read as null
- **Verify:** shell node --env-file=.env.local src/lib/goals.check.ts
- **Caller:** `GET /api/day`, `PATCH /api/steps/[id]` and `POST /api/goal`, which return goals to the browser
- **Verified:** no

### AC5: The prompts ask for it, using what Zeno learned

- **Given** the `stepFields` tool schema and `openingPrompt`
- **When** they are built
- **Then** both ask for "the minute after its start when a quiet check-in line shows, picked for this task, before its
  planned end", and tell Muse to shift it by the patterns it noticed about how long this person's steps really take;
  talk and the opening each still make the same number of model calls as before
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `talk()` in src/lib/agent.ts and `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC6: Muse really fills it (live smoke)

- **Given** a throwaway `@zeno.local` user with made-up data, against Muse
- **When** talk is asked 5 times to plan "PHIL 134 paper due Friday"
- **Then** in at least 4 of the 5 runs every step has a valid `checkin`
- **Caller:** src/app/api/talk/route.ts
- **Verified:** no

## Scope

### In Scope

- `steps.checkin` (database), `Step.checkin` and `FirstPick.steps[].checkin` (types), `NewStep.checkin`.
- The tool schemas, `checkCall` / `stepsOf`, `PLAN_STEP`, `checkPlan`, `checkPick`, and one prompt line.
- Updating the self-checks that compare whole steps (`agent.check.ts`, `goals.check.ts`).

### Out of Scope

- Showing the line: US0004.
- A rule-based minute when Muse gives none: the default lives in the browser (US0004).
- Learning from how people respond to check-ins: Later (EP0013).

## Technical Notes

- `src/lib/db.ts`: add `ALTER TABLE steps ADD COLUMN IF NOT EXISTS checkin INT` to `ensureSchema`'s transaction.
- `src/lib/day.ts`: `Step.checkin?: number | null` (minutes after the start when the quiet check-in line shows);
  `FirstPick.steps: { title: string; minutes: number; checkin?: number | null }[]`.
- `src/lib/goals.ts`: `NewStep.checkin?: number | null`; insert it in `setGoal` and `replaceRemainingSteps` (insert
  and update); select `s.checkin` in `goalQuery`; map it in `goalFrom` (`null` when absent).
- `src/lib/agent.ts`:
  - one helper, `checkinOf(value, minutes)`: an integer `1 <= value <= minutes - 1`, else null;
  - `stepFields.checkin`: `{ type: "integer", minimum: 1, maximum: 239, description: … }` (tools are sent without
    `strict`, so it can be left out);
  - `stepsOf` and `checkPlan` keep `checkinOf(item.checkin, minutes)`;
  - `PLAN_STEP`: add `checkin: { type: "integer" }` to `properties` and `required` (the schema is sent with
    `strict: true`);
  - `openingPrompt`: one sentence on each step's check-in minute.
- `src/app/api/goal/route.ts`: no change; it passes `plan.steps` to `setGoal`.
- Nothing personal: a number per step.

### API Contracts

- `POST /api/goal` body steps: `{ title, minutes, checkin? }`; an invalid `checkin` is saved as null, never a 400.
- Every goal in a response: `steps[i].checkin: number | null`.

### Data Requirements

- `steps.checkin INT NULL`. No backfill: old rows are null.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| `checkin` equals `minutes` (10 of 10) | null: a check-in at the end would be the old "time's up" |
| `checkin` above `minutes` | null |
| `checkin` 0 (the strict schema's "none") | null |
| `checkin` 2.5 or "5" or -1 | null |
| `minutes` null | `checkin` null |
| `minutes` 1 | `checkin` null (no room before the end) |
| `update_steps` keeps a step by ref and gives no `checkin` | null, the same way a missing minutes value is handled |
| The opening picks an existing step | Unchanged: the saved step brings its own `checkin` |
| The database has no column yet | `ensureSchema` adds it on the first call; reads give null |
| The model is down (rule pick) | No `checkin`; US0004's default minute applies |

## Test Scenarios

- [ ] `agent.check.ts`: `checkCall` keeps a valid `checkin` for `set_goal` and `update_steps` and nulls each bad value
      in AC2; whole-step `deepEqual`s gain `checkin`.
- [ ] `agent.check.ts`: `checkPlan` and `checkPick` keep or null `checkin`; `OPENING_SCHEMA` lists it as required.
- [ ] `agent.check.ts`: the stubbed-fetch talk and opening tests count the same number of model calls as before.
- [ ] `goals.check.ts` (real database, throwaway user): save, read, replace and keep steps with and without `checkin`.
- [ ] Live smoke (AC6) on a throwaway user; delete its rows after.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 5
**Complexity:** Medium

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Code | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |
| Database | Leave `steps.checkin` in place (nullable, unused after a revert) | None |

## Open Questions

- [ ] Is "learned per person" for Nov 4 enough as: Muse sees the patterns Zeno already learns when it picks the minute
      (OQ-12 default)? - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
