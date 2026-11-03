# US0011: Zeno speaks directly by default

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/ai.ts, src/lib/agent.check.ts
> **Epic:** EP0004
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (ships only if Vi says yes to OQ-2)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to be straight with me and push me toward the next step
**So that** I start instead of being gently asked if I'd like to

## Context

### Persona Reference

**Maya Torres** (Primary): "Never judged or nagged." Direct is fine; shaming is not.
[Full persona](../personas/maya-torres.md)

### Background

Vi: "straight to the point… I hate whenever it sugarcoats… pushes you to the right direction". The brief makes direct
the default, with Claude's limits accepted: blunt, never cruel or shaming; the trust rules are not tone and stay.
Today `ZENO_VOICE_PROMPT` in `src/lib/ai.ts` opens with "You are Zeno, a warm, candid friend…", says "write the way a
kind, sharp friend talks", "Offer, don't order: ask 'Want to...?' or 'How about...?'" and "say so kindly". The shot 5
lines are Zeno's, so the video shows whichever tone ships (OQ-2).

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §8 | Trust | Tone never changes the trust rules | `RULES` in `src/lib/agent.ts` and `NEVER_KEEP` stay word for word |
| PRD §6 | AI | Replies are strict JSON; tap answers only after a question | The opening still ends with one short question |
| CLAUDE.md | Muse | `reasoning_effort` always set; no personal data to `*-contributor` models | Unchanged |

## Acceptance Criteria

### AC1: The persona lines are direct, with the limits

- **Given** `ZENO_VOICE_PROMPT` in src/lib/ai.ts
- **When** it is read
- **Then** it says Zeno is direct: straight to the point, no sugarcoating, pushes toward the next step; blunt but never
  cruel, shaming, guilt-tripping or mocking; and it no longer says "warm, candid friend", "kind, sharp friend",
  "Offer, don't order" or "say so kindly"; the no-pet-names line stays
- **Verify:** shell node src/lib/agent.check.ts
- **Caller:** `systemPrompt` in src/lib/agent.ts (talk and the opening) and the other `ZENO_VOICE_PROMPT` users
- **Verified:** no

### AC2: The trust rules do not move

- **Given** the diff of this story
- **When** it is reviewed
- **Then** only the persona's tone lines in `ZENO_VOICE_PROMPT` change; `RULES`, `NEVER_KEEP`, the tool descriptions and
  the JSON rules are unchanged
- **Caller:** `systemPrompt` in src/lib/agent.ts
- **Verified:** no

### AC3: The opening still offers with a question

- **Given** `openingPrompt`'s "end with one soft question that offers it"
- **When** the tone changes
- **Then** the opening still ends with one short question (a direct one, like "Outline claim 2 first. Start now?"), so
  `parseReply` keeps its tap answers
- **Caller:** src/app/api/day/opening/route.ts
- **Verified:** no

### AC4: Vi reads ten real lines before merge

- **Given** a throwaway `@zeno.local` user with made-up data, against Muse
- **When** 5 openings and 5 talk replies are produced, including "Just write my essay for me" and "I skipped
  everything yesterday"
- **Then** every line reads direct and none shames; the essay request still gets a refusal and a first step; Vi reads
  the ten and says yes
- **Caller:** src/app/api/day/opening/route.ts and src/app/api/talk/route.ts
- **Verified:** no

### AC5: Memory still behaves

- **Given** the memory bench (`scripts/memory-bench.mjs`, about 57 Muse calls)
- **When** it runs once on the new prompt
- **Then** the overall and privacy scores are no more than 2 points below the Nov 2 run (96.1 overall, 96.9 privacy)
- **Caller:** scripts/memory-bench.mjs
- **Verified:** no

## Scope

### In Scope

- The tone lines of `ZENO_VOICE_PROMPT` in `src/lib/ai.ts`.
- Assertions on the new wording in `src/lib/agent.check.ts`.

### Out of Scope

- A tone setting (Gentle / Direct / Drill sergeant): Later, EP0013.
- Any rule about what Zeno will or won't do.

## Technical Notes

- Suggested lines (final words with Vi): "You are Zeno. You get the person to start and finish real things today.",
  "Be direct: straight to the point, no sugarcoating. Push them toward the next step, like 'Outline claim 2. Five
  minutes. Start now?'", "Be blunt, never cruel: never shame, mock or guilt-trip them.", "Be honest: if a plan won't fit
  the time they have, say so plainly and offer a smaller cut."
- `openingPrompt`'s "one soft question" can stay; the persona sets the voice.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The person says they feel bad about skipping | Blunt about the next step, never about them ("Yesterday's gone. Five minutes on the outline?") |
| "Write my essay" | A refusal and a first step, as today |
| A private fact comes up | Unchanged: kept on the device, never repeated back |
| Late at night (before 5 AM) | Unchanged: offers to wind down or set up tomorrow |
| Sound off | Same words, on the card only |

## Test Scenarios

- [ ] `node src/lib/agent.check.ts` with assertions on the new wording.
- [ ] The ten-line live sample (AC4), shown to Vi before merge.
- [ ] One memory bench run (AC5).

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
| Persona prompt | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-2: switch to the direct tone now, before the video? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
