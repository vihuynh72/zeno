# EP0003: A cheaper opening when nothing changed

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** S
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #1 of 13 (moved out of Nov 4: it changes nothing on screen and rewrites the opening path the demo runs; its stories are written, so it merges first when the freeze ends)
> **Target Release:** First after the Nov 9 live final (it was "Nov 4, if on production by Nov 3 evening"; moved after review)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** §5 AI cost per person per day

## Summary

Every time Zeno opens, the server asks Muse for the opening line and the first card, even when nothing changed since
the last open. This epic lets the server answer "same" when nothing the line depends on has changed. The browser
then keeps the line it already shows: no model call, no wait. It also stops one call the browser makes today and then
throws away.

**Goal:** Zeno stays instant and costs less to run, with no change anyone can see.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| PRD §5 | AI cost | About $0.10 or less per active person per day (proposed, OQ-15); Vi asked for fewer, smaller AI calls | Skip calls whose answer would not change |
| PRD §5 | Performance | The card on screen in 200 ms or less; the opening line in 4 s or less | "Same" answers without the model, so the line settles sooner |
| PRD L1, CLAUDE.md | Privacy | Private facts never reach the server's database or logs | The key is a one-way hash; nothing new is stored on the server |
| CLAUDE.md | Platform | Next 16: no `runtime`/`dynamic`/`revalidate` exports in routes | Logic stays inside the existing POST handler |

## Business Context

### Problem Statement

The opening (`POST /api/day/opening`) costs about $0.004 and 2-4 s each time. People open Zeno several times a day.
For anyone with private facts on the device or Canvas connected, the browser even asks twice: the early call made
before `/api/day` answers is used only when there are no device facts and no Canvas (`early` and `reuse` in
`src/components/guided-day.tsx`), so the demo account pays for two openings per load and uses one.
([PRD §5, AI cost](../prd.md#ai-cost-per-person-per-day))

**What Vi said:** on Nov 2, after connecting a real Canvas, Vi asked for Zeno to be cleaner and cheaper to run, with
fewer and smaller AI calls (PRD §5).

### Value Proposition

- **With it:** opening Zeno again makes no model call when nothing changed (about $0.004 saved per load, or $0.008
  with device facts or Canvas), and the line never flickers to a reworded one. With Sound on, a reload still speaks
  the same line through Google's voice, which costs about as much as the call it saves; not speaking an unchanged line
  again is a separate fix (PRD §5, "AI cost").
- **Without it:** every open pays one or two model calls, which adds up as people come back often (O3).
- **Why not Nov 4:** nothing about it shows on screen, it rewrites the opening route and the load path that shots 3
  and 6 run on, and it would land in the middle of the release check, the reset and the freeze.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Opening model calls per load when nothing changed | 1, or 2 with device facts or Canvas | 0 | Vercel runtime logs: "Model call" lines from `/api/day/opening` against "Opening reused" lines |
| AI cost per active person per day | About $0.08 (estimate) | $0.10 or less (OQ-15) | Logged tokens at list prices, as PRD §5 describes |

## Scope

### In Scope

- A key: a short one-way hash of everything the opening depends on, apart from the clock and free time.
- `POST /api/day/opening` with `since` (the key the browser holds) answers `{ state: "same" }` without a model call
  when the key still matches.
- The browser keeps the key with the model's opening and sends it back on the next open.
- The early call is made only when its answer can be used.

### Out of Scope

- Prompt caching for talk and the scan (the next lever in PRD §5).
- Talk, the daily scan and Sources: their costs stay as they are.
- Free time in the key. A shortcut, written in the code: a line that named free time can be up to one part of the day
  old.

### Affected Personas

- **Maya Torres (Primary):** opens Zeno several times a day; the line is there at once and stays the same.
- **Rosa Delgado, Daniel Okafor:** the same, on more opens.

## Acceptance Criteria (Epic Level)

- [ ] Opening Zeno again in the same part of the day, with nothing changed, makes no model call.
- [ ] Any change the line depends on (a step, a deadline, an event starting, new mail, a memory, a device fact,
      Canvas, the streak) brings a fresh line.
- [ ] A fallback (rule) line is never reused, so the model is tried again next time.
- [ ] Nothing new is stored on the server, and nothing about the key is logged.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| None | - | - |

US0013 (Nov 4) adds new-pattern ids to the opening; when this epic ships, its key must include them, so "same" never
hides a new pattern (US0008 notes it).

## Risks & Assumptions

### Assumptions

- The opening's model inputs are known in one place (`openingPrompt` and `systemPrompt` in `src/lib/agent.ts`), so the
  key can cover them all.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A change the key misses leaves a stale line | Low | Low | The key covers every prompt input except the clock and free time; a new part of the day always refreshes |
| A rule line gets reused after a model failure | Low | Medium | Rule answers carry no key |
| It lands late and risks the demo | Medium | Medium | Moved after the Nov 9 final: it never touches the demo's opening path before then |

## Technical Considerations

### Architecture Impact

- `openingKey(...)` in `src/lib/agent.ts`, next to `openingPrompt`, using `createHash` from `node:crypto` (only routes
  import `agent.ts`).
- `OpeningResponse` in `src/lib/day.ts` gains `key` and a `{ state: "same" }` answer.
- The browser's saved day (`zeno:day`, the `Opening` type in `src/components/guided-day.tsx`) keeps the key.

### Integration Points

- Muse is called less; nothing else changes.

## Sizing

**Size:** S

**Estimated Story Count:** 2

**Derived Point Total:** 5

**Complexity Factors:**

- Getting the key's inputs exactly right, so it neither misses changes nor changes every minute.

## Story Breakdown

- [ ] [US0008: The opening skips the model when nothing changed](../stories/US0008-the-opening-skips-the-model-when-nothing-changed.md)
- [ ] [US0009: The browser reuses its saved opening](../stories/US0009-the-browser-reuses-its-saved-opening.md)

## Test Plan

- Self-check: `node src/lib/agent.check.ts` (the key is stable inside a part of the day and changes with each input).
- Manual: Chrome DevTools (network) and Vercel runtime logs on production with the demo account.

## Open Questions

- [ ] When does it ship? Default: first after the Nov 9 final, built on a branch with a preview deploy before then.
      Option: before the video, only if Vi wants it and it is on production before the Nov 3 reset. - Owner: Vi
- [ ] On a reload with nothing changed, should Zeno say the same line again (with Sound on it speaks it once per load
      today)? Default: no, the line stays on screen unspoken, which also saves the voice cost (PRD §5). - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief and the code at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: moved to Later, first after the Nov 9 final (nothing on screen, and it rewrites the demo's opening path); the 'costs nothing' line corrected for the voice cost; no longer blocks US0013 |
