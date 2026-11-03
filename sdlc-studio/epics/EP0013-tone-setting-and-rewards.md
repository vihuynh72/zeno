# EP0013: Tone setting and rewards

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #10 of 13
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** I5, I3, A6, I6 (if Vi says yes), B3 (if not shipped Nov 4), and the pattern said out loud (if not shipped Nov 4); OQ-12, OQ-21

## Summary

A tone setting: Gentle, Direct (the default) or Drill sergeant. A short end-of-day recap. Zeno says a newly noticed
pattern out loud once. The check-in minute adapts to each person over time, from how their steps go after the line
shows. And, if Vi says yes to OQ-21, a choice of Muse model next to the tone.

**Goal:** people come back because Zeno helps and feels like theirs, not because it nags.

## Business Context

### Problem Statement

One voice does not fit everyone: Vi wants Zeno direct and pushy by default, and some people need gentler words. Today
there is no recap of the day, patterns save silently, and the check-in minute (EP0001) does not adapt from how the
person responds. ([PRD section I](../prd.md#i-motivation-and-personality))

**What Vi said:** Zeno is "straight to the point… I hate whenever it sugarcoats… pushes you to the right direction";
a tone setting later (Gentle / Direct / Drill sergeant). Rewards: the DONE stamp and a small sound, an end-of-day
recap, goal progress, Zeno noticing patterns. Claude's limits, accepted: blunt, never cruel or shaming; the trust rules
are not tone and stay (never does the work, never sends mail without you, never keeps private data).

### Value Proposition

- **With it:** Zeno sounds right to each person, and the end of a day feels like progress.
- **Without it:** one tone, and wins that go unsaid.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Back on most days (O3) | Not measured | 50% or more (proposed, OQ-15) | The daily "opened" mark (EP0005) |
| People who change the tone | Not possible | Watched, no target | Setting changes |

## Scope

### In Scope

- A tone setting in the account menu: Gentle, Direct (default), Drill sergeant. (I5)
- An end-of-day recap: one or two lines on what got done, shown once in the evening. (I3)
- Zeno says a newly noticed pattern out loud once, if US0013 did not ship on Nov 4.
- The check-in minute adapts per person over time (A6, OQ-12). On Nov 4 Muse already shifts it by how long this
  person's steps take (US0003); this epic adds what the brief's "learn from the user over time" needs on top: how
  steps go after the line shows. If most finished steps end far past the line, the minute moves later; if most end
  within a minute or two of it, it moves earlier, so the line lands while there is still work to do. It uses only
  the start, finish and check-in minute Zeno already saves on each step.
- The soft Done sound, if US0012 did not ship on Nov 4. (B3)
- A Muse model choice in the account menu, next to Sound and the tone, shared with Plan mode's picker, if Vi says yes
  to OQ-21 (brief §8: "Chat: choose among Muse models"). Never a `*-contributor` model. (I6)

### Out of Scope

- Changing the trust rules by tone. Never: every tone keeps "never does the work, never sends mail without you, never
  keeps private data".
- Shaming, guilt or mocking in any tone, Drill sergeant included.
- New tracking to learn the check-in (OQ-12 default: no new tracking).

### Affected Personas

- **Maya Torres (Primary):** "Never judged or nagged." Direct, never shaming.
- **Rosa Delgado:** may want Gentle.
- **Daniel Okafor:** may want Drill sergeant on deep-work days.

## Acceptance Criteria (Epic Level)

- [ ] The tone setting changes how Zeno words things, and nothing about what it will or won't do.
- [ ] No tone produces a shaming or cruel line in a 20-line review by Vi.
- [ ] The evening recap shows at most once a day and never as a notification.
- [ ] A new pattern is said once, never repeated as news.
- [ ] The check-in minute moves with how a person's steps go after the line shows: later when most finished steps run
      far past it, earlier when most end within a minute or two of it. It reads only each step's saved start, finish
      and check-in minute; no new tracking. (Muse's per-task pick from real step lengths ships on Nov 4, US0003.)
- [ ] If Vi says yes to OQ-21, the model choice lives in the account menu, shared with Plan mode, and never offers a
      `*-contributor` model.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0009 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0001 | The check-in minute this epic adapts | Draft |
| EP0006 | Goal progress for the recap | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| None | - | - |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Drill sergeant turns cruel | Medium | High | The limits are in the prompt for every tone; Vi reviews samples |
| The recap feels like homework | Low | Medium | Two lines, once, skippable |

## Technical Considerations

### Architecture Impact

- `ZENO_VOICE_PROMPT` in `src/lib/ai.ts` gains variants; the setting lives with Sound in the account menu.
- `src/lib/patterns.ts` already learns real step lengths. The check-in learning reads `steps.started_at`,
  `steps.done_at` and `steps.checkin` (US0003) for the person's recent finished steps.

## Sizing

**Size:** M

**Estimated Story Count:** 5

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-12: what the check-in learns from. Default: only what Zeno already saves: each step's start, finish and
      check-in minute (did the person finish soon after the line, or run far past it?), plus real step lengths and
      time of day; no new tracking. - Owner: Vi
- [ ] OQ-21: does talk get a Muse model choice too? Default: yes, in the account menu, shared with Plan mode. - Owner:
      Vi
- [ ] Is the tone kept per device (like Sound) or per account? Default: per account, so the phone and laptop agree. -
      Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: the check-in minute learns from how steps go after the line shows (US0003 already covers real step lengths); OQ-12 default updated; the Muse model choice for talk if Vi says yes to OQ-21; #10 of 13 |
