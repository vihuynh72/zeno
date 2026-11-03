# US0015: Release check and freeze before recording

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** HANDOFF.md
> **Epic:** EP0004
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (the freeze is Vi's call)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** every Nov 4 change checked together on production before the video, and then left alone
**So that** each take shows the real app working, with no surprise from a late change

## Context

### Persona Reference

**Maya Torres** (Primary): the demo persona; every shot is her day. [Full persona](../personas/maya-torres.md)

### Background

CLAUDE.md lists the checks every merge passes. DEMO-NOV4.md proposes a freeze: once the Nov 4 items are live, only
fixes go to `main` until the video is done. Production deploys from `main` (Vercel). This check runs on the demo
account before the reset (US0016), because the reset is the last step before shot 3.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| CLAUDE.md | Quality | `npx next typegen`, `npx tsc --noEmit --incremental false`, `npx eslint src/`, `npx next build`, every `*.check.ts` and `scripts/*-check.mjs` | All pass on the merged `main` |
| Brief §1 | Deadline | Production stable by the morning of Nov 4 | The check and the freeze happen on Nov 3 |
| CLAUDE.md | Data | Never Vi's own account | The live run uses the demo account |

## Acceptance Criteria

### AC1: Every check passes on `main`

- **Given** every Nov 4 story Vi approved, merged to `main`
- **When** the CLAUDE.md checks run on that commit
- **Then** typegen, tsc, eslint, build, every `*.check.ts` and `scripts/*-check.mjs` pass (run by hand; no single
  command covers them all, so no `Verify:` line that would pass on a part)
- **Caller:** n/a
- **Verified:** no

### AC2: Production is on that commit and answers

- **Given** the merge
- **When** Vercel finishes the deploy
- **Then** the production deployment is Ready on that commit, the home page loads signed out, and `/api/day` answers
  signed-out requests with 401
- **Caller:** n/a
- **Verified:** no

### AC3: The demo path works on production

- **Given** the demo account in Chrome at 1440x900, Sound on
- **When** Claude walks the path
- **Then** each step works: the card → Start → the stopwatch counting up with "of N min" → the check-in line at its
  minute (a short step) → 70 s away from the tab → "Back. N min on '…'." → Done → the stamp (and the sound, if US0012
  shipped) → "Nice. Next: …"; Talk: a sentence with a 2-second pause after "and" becomes one turn; "Done talking" sends
  at once; "Put the study time on my calendar" → Book → the event shows no notifications (if US0010 shipped); a draft to
  Prof Patel opens with a To (if US0014 is done); "Just write the paper for me" → a refusal and a first step; a reload
  with nothing changed answers `same` (if EP0003 shipped)
- **Caller:** n/a
- **Verified:** no

### AC4: Findings are fixed or written down

- **Given** anything that failed in AC3
- **When** the check ends
- **Then** each is fixed (and AC1 to AC3 rerun), or written in HANDOFF section 0 "Known issues" with the shot it affects
  and its fallback
- **Caller:** n/a
- **Verified:** no

### AC5: The freeze

- **Given** Vi approved the freeze
- **When** the check passes
- **Then** from then until the video is submitted, only fixes go to `main`, each with all checks passing; HANDOFF
  section 0 says the freeze is on and when it ends
- **Caller:** n/a
- **Verified:** no

## Scope

### In Scope

- Running the checks, the deploy check and the live path; recording the result and the freeze in `HANDOFF.md`.

### Out of Scope

- The reset (US0016) and the recording itself.

## Technical Notes

- The live path changes the demo account's data (a booking, a finished step); that is fine, because US0016 resets it
  right after.
- If a later fix lands during the freeze, rerun AC1 and the parts of AC3 it touches.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| A Nov 4 story is not ready by Nov 3 evening | Leave it out; the release check covers what shipped; DEMO-NOV4.md's fallback order applies |
| The check finds a bug in a shot's path | Fix and rerun, or record it with the fallback |
| Vercel deploy fails | Fix forward or roll back with Vercel's Instant Rollback; rerun |
| Muse is slow or down during the check | Rerun later; the rule fallbacks must still give a working Start |
| Voice cannot be tested in that room | Test typing; record voice shots after a voice check |

## Test Scenarios

- [ ] All CLAUDE.md checks on the merged `main` (AC1).
- [ ] The production path (AC3), with a short written result in HANDOFF section 0.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0001](US0001-focus-shows-a-stopwatch-that-counts-up.md) | Code | On `main` | Draft |
| [US0002](US0002-focus-stays-silent.md) | Code | On `main` | Draft |
| [US0004](US0004-one-quiet-check-in-line-at-that-minute.md) | Code | On `main` | Draft |
| [US0005](US0005-a-back-line-after-time-away-from-the.md) | Code | On `main` | Draft |
| [US0006](US0006-zeno-keeps-listening-after-an-unfinished-sentence.md) | Code | On `main` | Draft |
| [US0007](US0007-a-done-talking-tap-ends-the-turn-at.md) | Code | On `main` | Draft |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| The other Nov 4 stories Vi approves (US0003, US0008 to US0014) | Code or Vi's action | Draft |
| Vi's yes to the freeze | Decision | Open |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* It checks and records; fixes it triggers carry their own
rollback.

## Open Questions

- [ ] The freeze: fixes only on `main` from this check until the video is submitted? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from docs/DEMO-NOV4.md and CLAUDE.md. Three Amigos lenses applied in-session by the author, not an independent review |
