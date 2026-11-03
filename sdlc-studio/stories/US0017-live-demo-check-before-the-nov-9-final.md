# US0017: Live-demo check before the Nov 9 final

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** HANDOFF.md
> **Epic:** EP0004
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (DQ-4 and DQ-5 are Vi's calls)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** the app to work as well when Vi shows it live on Nov 9 as it did in the video
**So that** the judges see my real day, with nothing broken by a change made after the video

## Context

### Persona Reference

**Maya Torres** (Primary): the demo persona; the live final shows her account. [Full persona](../personas/maya-torres.md)

### Background

The hackathon notes: judging runs Nov 4-8, the live final and winners are on Nov 9, and the demo score (25%) counts
live robustness as well as the video. Vi must be able to demo live. `main` deploys to production, so the freeze (fixes
only on `main`, US0015, DQ-4) runs through the final, and the Later epics are built on branches with Vercel preview
deploys until then.

After Nov 4 the demo account holds day 1 (Nov 3) and day 2 (Nov 4): what Zeno learned, the streak and the Memory list.
A reset before the final would allow a live first sign-in but erase what Zeno learned, so the account's state for the
final is Vi's call (DQ-5 in `docs/DEMO-NOV4.md`).

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Hackathon notes | Deadline | Live final Nov 9; the demo score counts live robustness | The check runs on Nov 8 or early on Nov 9 |
| CLAUDE.md, memory | Data | Never Vi's own account; the demo account only | The live path uses the demo account |
| DEMO-NOV4.md | Honesty | Never script or seed a pattern Zeno did not find | The final shows what real use taught Zeno |

## Acceptance Criteria

### AC1: Production is still the frozen build

- **Given** the freeze since the release check (US0015 AC5)
- **When** Claude compares production with `main` on Nov 8
- **Then** production is Ready on the latest `main` commit, every commit since the release check is a fix that passed
  the CLAUDE.md checks, and no Later epic is on `main`
- **Caller:** n/a
- **Verified:** no

### AC2: The live path works again

- **Given** the demo account in the recording Chrome profile, Sound on
- **When** Claude walks the path of US0015 AC3 (the card, Start, the stopwatch, "Back.", the check-in line, Done, talk
  with a pause after "and", a booking, the Gmail draft, the refusal)
- **Then** each step works on production; anything that fails is fixed under the freeze (with all checks) or written
  in HANDOFF section 0 with its fallback for the live demo
- **Caller:** n/a
- **Verified:** no

### AC3: The account is ready the way Vi chose (DQ-5)

- **Given** Vi's answer to DQ-5 (default: no reset)
- **When** the check ends
- **Then** the account is in that state: the booking made by the check is undone, Sound is on, Canvas is still linked,
  and HANDOFF section 0 lists what the live demo can show (for example "the card is there at once; Memory shows what
  Zeno learned")
- **Caller:** n/a
- **Verified:** no

### AC4: The freeze ends after the final

- **Given** the final is over (Nov 9)
- **When** Claude updates the handoff
- **Then** HANDOFF section 0 says the freeze is off, and the first Later epic in the order (EP0003) may merge
- **Caller:** n/a
- **Verified:** no

## Scope

### In Scope

- Comparing production with `main`; the live path on production; the account's state for the final; recording all of
  it in `HANDOFF.md`.

### Out of Scope

- New features before the final: none, the freeze holds.
- Vi's own script and slides for the final.
- Seeding steps or patterns on the demo account: never. Only Vi's real use counts.

## Technical Notes

- Run it on Nov 8 (or early on Nov 9), after the last fix. If a fix lands later, rerun the parts of AC2 it touches.
- The check changes the demo account's data (a finished step, a booking). Undo the booking; a finished step is real
  use of the app and stays.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| A fix is needed on Nov 9 | Only with all checks passing and the path it touches rerun; otherwise record the fallback |
| Muse is slow or down on Nov 9 | The rule fallbacks still give a working Start; Vi shows talk from the video instead |
| The account's pattern stopped holding and was dropped | Show the card and Memory as they are; never seed a pattern |
| Vi chose a reset (DQ-5) | Reset as in US0016 (keep the Canvas key and Sound), right before the final, and show the first sign-in live |

## Test Scenarios

- [ ] Production and `main` compared (AC1).
- [ ] The live path, with a short written result in HANDOFF section 0 (AC2, AC3).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0015](US0015-release-check-and-freeze-before-recording.md) | Process | The release check and the freeze | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Vi's answers to DQ-4 (the freeze through Nov 9) and DQ-5 (the account for the final) | Decision | Open |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* It checks and records; fixes it triggers carry their own
rollback.

## Open Questions

- [ ] DQ-5: the demo account for the Nov 9 live final. Default: no reset; show the live path from the card, and the
      first sign-in from the video. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from the review finding on the Nov 9 live final and the hackathon notes. Not an independent review |
