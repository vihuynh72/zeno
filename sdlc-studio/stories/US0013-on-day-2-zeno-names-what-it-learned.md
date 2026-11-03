# US0013: On day 2 Zeno names what it learned, once

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/app/api/day/opening/route.ts, src/lib/agent.ts, src/lib/agent.check.ts, src/lib/day.ts, src/components/guided-day.tsx
> **Epic:** EP0004
> **Points:** 3
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (ships only if Vi says yes to OQ-5)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to tell me once what it noticed about how I work, and use it
**So that** I can see day 2 is smarter because of day 1

## Context

### Persona Reference

**Maya Torres** (Primary): she wants Zeno to learn from what she does, never from questions.
[Full persona](../personas/maya-torres.md)

### Background

Shot 6 of the demo: "Zeno's line names what it learned, for example 'You get more done before noon, so the hard one
first.'" Today `learnFromSteps` (`src/lib/patterns.ts`) saves a new pattern as a memory (source "pattern", group
"patterns") after a step is finished or skipped. When that happens in talk, Zeno says it ("When a tool result has
noticed, say that pattern in one short line" in `ZENO_VOICE_PROMPT`). When it happens on a Done tap
(`PATCH /api/steps/[id]` returns `learned`), it saves silently (no quiet lines since Nov 2). The opening sees every
memory but nothing marks one as new, so day 2 may not say it. PRD OQ-5's default: the first opening after a new
pattern mentions it once.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| DEMO-NOV4.md | Honesty | Never script a pattern Zeno did not find | Only a saved pattern memory can be named, in its own words |
| PRD §6 | AI | Model output is untrusted; facts in the prompt are data | The pattern is listed as data with its id; ids are checked |
| PRD L1 | Privacy | Nothing private to the server | Pattern memories are already server memories; the browser list holds ids only |

## Acceptance Criteria

### AC1: A pattern learned yesterday reaches today's opening

- **Given** a memory with source "pattern" learned on an earlier local day: created at or after the start of the
  person's yesterday and before the start of their today (`yesterday.start <= created_at < today.start`, from
  `dayBounds`), whose id is not in the request's `heard` list
- **When** `newPattern(memories, heard, since, before)` picks it and `openingPrompt` is built with it
- **Then** the prompt has one extra line, "New since yesterday, from what they did: <text>. Say it once, in a few
  words, like 'You get more done before noon, so the hard one first.'" (no "if it shapes the pick": the browser
  marks it heard, so Muse must say it); the route returns the memory's id in `noticed` (AC2). A pattern learned
  today is not picked: it waits for tomorrow's first opening, so reopening Zeno on day 1 never spends it
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC2: The browser remembers what it has shown

- **Given** the route returned an `ok` opening with `noticed: ["<id>"]`, and `onOpening` shows it
- **When** the line is shown
- **Then** the id is added to `zeno:heard:<account>` in local storage (at most 20 ids, the newest kept), and the next
  opening request sends `heard` with those ids, so that pattern is never "new" again
- **Caller:** `onOpening` and `fetchOpening` in src/components/guided-day.tsx
- **Verified:** no

### AC3: Nothing new, nothing added

- **Given** no pattern memory learned yesterday (only older ones, or ones learned today), or all of them already heard
- **When** the opening is written
- **Then** the prompt has no "New since yesterday" line, and `noticed` is empty or absent
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC4: The input is checked

- **Given** a `heard` value in the body
- **When** the route reads it
- **Then** it keeps at most 20 strings shaped like ids (`isId` in src/lib/goals.ts) and ignores the rest; it is never
  logged
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `opening()` in src/app/api/day/opening/route.ts
- **Verified:** no

### AC5: The demo (shot 6)

- **Given** the demo account after a real day 1 (Nov 3) that taught Zeno a pattern, and no opening of the demo
  account on Nov 4 before shot 6
- **When** Zeno opens on the morning of Nov 4
- **Then** the first opening names the pattern in Zeno's words, and an opening later that day does not repeat it as
  news; a retake works after `zeno:heard:<account>` is removed from local storage (DEMO-NOV4.md, "Before every take")
- **Caller:** src/app/api/day/opening/route.ts
- **Verified:** no

## Scope

### In Scope

- The new-pattern line in `openingPrompt` (`src/lib/agent.ts`) and its input from the route.
- `noticed` on `OpeningResponse` and `heard` in the POST body (`src/lib/day.ts`).
- The heard list in `src/components/guided-day.tsx`.

### Out of Scope

- Saying a pattern at the moment of a Done tap: patterns still save silently there.
- New kinds of patterns: `patternsIn` is unchanged.

## Technical Notes

- Two small pure helpers in `src/lib/agent.ts`, next to `cleanCanvas`, so `agent.check.ts` can test them:
  `cleanHeard(raw)` (at most 20 id-shaped strings) and `newPattern(memories, heard, since, before)` (the newest memory
  with source "pattern", created at or after `since` and before `before`, not in `heard`, or null).
- Route: `since` is the start of the person's yesterday and `before` the start of their today, which the route already
  computes (`yesterday.start`, `today.start`); it passes `newPattern(context.memories, cleanHeard(body.heard),
  yesterday.start, today.start)` to `openingPrompt` and returns its id in `noticed`.
- If EP0003 (the cheaper opening, Later) ships, its key must include the new-pattern ids, so a "same" answer never
  hides a pattern (US0008 notes it).
- `openingPrompt(context, firstName, finished, refs, now, noticed?)`: one line when `noticed` is set.
- Browser: `zeno:heard:<account>` (the opaque account key, like the vault's). It holds memory ids only, nothing
  private, so sign-out may leave it. A blocked storage means a pattern can be named once per part of the day;
  acceptable.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Two new patterns | Only the newest is named; the other waits for a later opening |
| The person forgot the pattern in Memory | It is no longer a memory, so it is never named |
| The model fails | The rule line; `noticed` is not returned, so nothing is marked heard |
| `heard` holds junk or 500 items | Junk dropped; at most 20 kept |
| Storage blocked | No heard list; the pattern may be named once per part of the day |
| The pattern was said in talk on day 1 | Still named once on day 2 (shot 6 needs it) unless already in `heard` |
| A pattern learned today (day 1, after the 5th finished step), then Zeno reopened that day | Not named: it is not from an earlier day yet; tomorrow's first opening names it |
| A pattern learned two or more days ago, never named (the person skipped a day) | Not named: the line says "since yesterday"; the pattern still shapes plans silently |
| A shot-6 retake | Remove `zeno:heard:<account>` from local storage first; the next opening names it again |

## Test Scenarios

- [ ] `agent.check.ts`: `openingPrompt` with and without `noticed` (the line has no "if it shapes the pick"); the
      helper picks the newest unheard pattern from yesterday and skips one from today and one from two days ago;
      `heard` cleaning.
- [ ] Local: a throwaway user with a pattern memory dated yesterday: the first opening names it and returns its id; the
      next, with `heard`, does not; a pattern dated today is not named.
- [ ] Nov 4 morning on the demo account (shot 6), with no opening of the account before it.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None for Nov 4 | - | EP0003 (Later) must put the new-pattern ids in its key when it ships | - |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| A real day 1 on the demo account (Nov 3, from the 2 PM reset) with 5+ finished steps, 60% in one part of the day | Data (DEMO-NOV4.md) | Nov 3 |

## Estimation

**Points:** 3
**Complexity:** Medium

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Opening prompt and route | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-5: on day 2, should Zeno name a newly learned pattern once in the opening? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: only a pattern learned on an earlier day (yesterday) is named, so day 1 reopenings never spend it; the prompt line is unconditional; AC5 on the cheaper opening removed (EP0003 is Later); shot-6 retake and no-open-before-shot-6 rules |
