# US0008: The opening skips the model when nothing changed

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/app/api/day/opening/route.ts, src/lib/agent.ts, src/lib/agent.check.ts, src/lib/day.ts
> **Epic:** EP0003
> **Points:** 3
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to reuse the opening it already gave me when nothing has changed
**So that** opening Zeno again is instant and Zeno stays cheap enough to keep free

## Context

### Persona Reference

**Maya Torres** (Primary): "opens Zeno a few times a day". [Full persona](../personas/maya-torres.md)

### Background

`POST /api/day/opening` (`src/app/api/day/opening/route.ts`) loads the person's context (`loadUserContext`), then calls
Muse once with `systemPrompt` and `openingPrompt` (`src/lib/agent.ts`) for the line, the tap answers and the first
card's pick. It costs about $0.004 and 2-4 s each time (PRD §5). The PRD notes Vi asked on Nov 2 for fewer, smaller
AI calls.

`openingPrompt` contains the clock ("It is now 9:42 AM", via `dayToText`) and the rest of today's free time, so hashing
the prompt itself would change every minute. The key below covers the inputs, minus those two.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| PRD L1 | Privacy | Private facts never reach the server's database or logs | The key is a one-way hash; nothing is stored or logged |
| PRD §5 | Security | Input from outside is untrusted | `since` must be 16 hex characters, else ignored |
| CLAUDE.md | Platform | No `runtime`/`dynamic`/`revalidate` exports in route files | The change lives inside `opening()` |
| CLAUDE.md | Platform | Dates and times through `src/lib/tz.ts` | The date and hour come from `localDate` and `localHour` |

## Acceptance Criteria

### AC1: A key for what the opening depends on

- **Given** `openingKey(context, firstName, finished, privateFacts, now)` in src/lib/agent.ts
- **When** it is computed
- **Then** it returns the first 16 hex characters of a SHA-256 over: the account, the person's date and part of the
  day (late before 5, morning before 12, afternoon before 17, evening; the cut points `openingPrompt` uses), the first
  name, the goal (id, title, due) and its steps in order (id, title, minutes, status), deadlines (title, date), today's
  events (title, start, end, all-day, and whether each has started and ended at `now`), unread emails (from, subject),
  memories (id, text), device facts, Canvas briefs, the streak and whether it is at risk, the steps finished yesterday,
  and the calendar and email read states; lists that have no order (memories, device facts, Canvas briefs, emails) are
  sorted first
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC2: The key holds still inside a part of the day, and moves with any change

- **Given** one fixed context
- **When** the key is computed at 9:05 and at 9:50, then at 11:59 and at 12:01, then with one input changed at a time
  (a step's status, a new deadline, an event that has started, a new unread email, a new memory, a new device fact, a
  new Canvas brief, the streak at risk, a new finished step), then with only the free time changed
- **Then** 9:05 and 9:50 match; 11:59 and 12:01 differ; each changed input gives a new key; a free-time-only change
  gives the same key
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC3: "Same" answers without a model call

- **Given** a signed-in POST to `/api/day/opening` whose body has `since` equal to the key the route computes
- **When** the route runs
- **Then** it answers `{ "state": "same", "key": "<key>" }` without calling `askModel` (no "Model call" log line) and
  logs one line, "Opening reused", with nothing else in it
- **Caller:** `fetchOpening` in src/components/guided-day.tsx (US0009)
- **Verified:** no

### AC4: Otherwise the model answers, as today, with the key

- **Given** a POST with no `since`, or a `since` that does not match
- **When** the model answers and its reply passes the checks
- **Then** the answer is today's `{ state: "ok", opening, options, pick }` plus `key`
- **Caller:** `onOpening` in src/components/guided-day.tsx
- **Verified:** no

### AC5: Rule answers never carry a key

- **Given** no AI configured, a model failure, or a pick that fails its checks (the rule path)
- **When** the route answers with `ruleOpening`, `ruleOptions` and `rulePick`
- **Then** the answer has no `key`, so the next open tries the model again (checked by reading the route and by a
  local run with the Muse key unset)
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC6: The contract

- **Given** src/lib/day.ts
- **When** it is read
- **Then** `OpeningResponse` is `{ state: "ok"; opening; options; pick; key?: string } | { state: "same"; key: string } |
  { state: "signed-out" | "error" }`, and the POST body comment lists `since?: string`; `GET` is unchanged
- **Verify:** grep "state: .same." src/lib/day.ts
- **Caller:** `fetchOpening` and `onOpening` in src/components/guided-day.tsx (US0009)
- **Verified:** no

## Scope

### In Scope

- `openingKey` in `src/lib/agent.ts`, using `createHash` from `node:crypto` (only route files import `agent.ts`).
- The `since` check and the `same` answer in `opening()`; `key` on model answers.
- The `OpeningResponse` type.

### Out of Scope

- The browser side: US0009.
- Free time in the key. Shortcut, commented in the code: a line that named free time can be up to one part of the day
  old; add free time rounded to the hour if that shows up.
- Prompt caching (PRD §5's next lever).

## Technical Notes

- Compute the key after `loadUserContext` and the yesterday query, before `askModel`. The context load stays (the
  key needs it).
- Validate `since`: `typeof since === "string" && /^[0-9a-f]{16}$/.test(since)`; anything else is treated as absent.
- Never log `since`, the key or the inputs.
- US0013 (Nov 4) puts new-pattern ids into the opening; they join the key's inputs, so "same" never hides a new
  pattern.

### API Contracts

- Request: `POST /api/day/opening` with `{ private?: string[], canvas?: CanvasBrief[], since?: string }`.
- Responses: `200 { state: "same", key }`; `200 { state: "ok", opening, options, pick, key? }`; `401 { state:
  "signed-out" }`.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| `since` is not 16 hex characters (or not a string) | Ignored: the model path runs |
| `since` is from another account | No match (the account is in the key): the model path runs |
| Signed out | `401 { state: "signed-out" }`, as today |
| AI not configured | The rule answer, no key, as today |
| The part of the day changes between two opens | Different keys: a fresh line |
| An event starts between two opens | Different keys: a fresh line |
| Device facts in a different order | The same key (sorted) |
| The steps in a different order | A different key (order matters for the plan) |
| The daily scan saved new memories | A different key: a fresh line |
| Calendar read fails this time | The read state is in the key: a fresh (honest) line |

## Test Scenarios

- [ ] `agent.check.ts`: the cases in AC2.
- [ ] Local run with the Muse key unset: the rule answer has no `key` (AC5).
- [ ] Local (`next dev`, throwaway user): two POSTs, the second with the first's key, answer `same`, and the server log
      shows one "Model call" line, not two.
- [ ] Production logs after release: "Opening reused" lines appear; no `since` value is ever logged.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 3
**Complexity:** Medium

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Opening route | Revert the merge commit on `main`; Vercel redeploys. Browsers holding a key just get model answers again | About 2 minutes |

## Open Questions

- [ ] When does it ship? Default: first after the Nov 9 live final (EP0003 moved to Later: nothing about it shows on
      screen, and it rewrites the opening path the demo runs). - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fix: EP0003 moved to Later, first after the Nov 9 final; US0013's new-pattern ids join the key |
