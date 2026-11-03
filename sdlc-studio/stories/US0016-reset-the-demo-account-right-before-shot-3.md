# US0016: Reset the demo account right before shot 3

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Epic:** EP0004
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (DQ-1 is Vi's call)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** the demo account to start fresh right before the first-sign-in shot, and then live a real day 1
**So that** shot 3 shows a true first sign-in and shot 6 shows a true day 2

## Context

### Persona Reference

**Maya Torres** (Primary): the demo persona. [Full persona](../personas/maya-torres.md)

### Background

DEMO-NOV4.md, "Recording plan": shot 3 needs a freshly reset account, and shot 6 needs a real day 1 on that same
account. HANDOFF says to reset on the morning of Nov 4, which would erase day 1 (DQ-1). The proposed order: reset on
Nov 3, once the Nov 4 items are on production, then record shot 3, then use Zeno for real for the rest of Nov 3, and
record shot 6 on Nov 4 morning without a reset.

The reset steps (HANDOFF section 0a, "The demo account now"), with one change from later notes: keep the
`zeno.canvas.<account>` key so Canvas stays connected.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| CLAUDE.md, memory | Data | Never touch Vi's own account | Every delete names the demo address only; other accounts' counts are compared before and after |
| DEMO-NOV4.md | Honesty | Do not seed fake history | Day 1 is real use only |
| CLAUDE.md | Secrets | Never print or commit secrets | The SQL runs with `DATABASE_URL` from `.env.local`, never echoed |

## Acceptance Criteria

### AC1: No Zeno blocks left on the calendar

- **Given** the demo account signed in on production
- **When** each event that `/api/calendar/week` marks as Zeno's (this week and next) is undone with
  `DELETE /api/calendar/book/{id}`
- **Then** the Week shows only Maya's own events
- **Caller:** n/a
- **Verified:** no

### AC2: No Zeno rows for the demo account, and nobody else's touched

- **Given** the row counts per table for every account, taken first
- **When** the demo account's rows are deleted from `steps`, `goals`, `tasks`, `memories` and `user_state` (each
  `DELETE` names the demo address)
- **Then** the demo account has 0 rows in each of the five tables, and every other account's counts are unchanged
- **Caller:** n/a
- **Verified:** no

### AC3: The browser starts fresh, Canvas stays

- **Given** the Chrome profile used for recording
- **When** the local storage keys that start with "zeno" are removed, except `zeno.canvas.<account>` and `zeno:sound`
- **Then** the vault, the saved day, the scanned mark (and the heard list, if US0013 shipped) are gone, Canvas is still
  linked, and Sound is turned on in the account menu
- **Caller:** n/a
- **Verified:** no

### AC4: The next sign-in is a first sign-in

- **Given** AC1 to AC3 done
- **When** the demo account opens Zeno
- **Then** it shows "Reading your calendar and email…", then the line of what it found and [Start my day]; this is shot
  3, recorded right away
- **Caller:** n/a
- **Verified:** no

### AC5: Only on Nov 3, after the release check

- **Given** the release check (US0015) passed
- **When** the reset is done
- **Then** it happens on Nov 3, never on Nov 4, so day 1 (Nov 3's real use, 5 or more finished steps) survives for
  shot 6
- **Caller:** n/a
- **Verified:** no

## Scope

### In Scope

- Undoing Zeno's calendar blocks, deleting the demo account's rows, clearing the browser keys, and turning Sound on.

### Out of Scope

- Maya's own calendar events and emails: kept.
- Any change to Vi's own account: never.
- Seeding history for day 2: never.

## Technical Notes

- Order on Nov 3: US0014 (name and Patel email) → US0015 (release check and freeze) → this reset → shot 3 → shots 4
  and 5 → real use for the rest of the day.
- The `user_state` row holds the Zeno calendar's id; deleting it is fine: on the next booking, `ensureZenoCalendar`
  (`src/lib/calendar.ts`) finds the existing "Zeno" calendar in the account's list, or makes one.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| An undo fails | Retry once; if it still fails, delete that event in Google Calendar by hand |
| The SQL count for another account changed | Stop; investigate before going on (it must never happen) |
| The Canvas key was removed by mistake | Vi reconnects Canvas from the account menu (Vi pastes the token; agents never type tokens) |
| The scan finds nothing on first sign-in | It retries on the next open; "Paste notes" is the backup (DEMO-NOV4.md) |
| The Nov 4 items are late | Reset and record shot 3 anyway; record shots 4 and 5 on Nov 4 morning after shot 6 (DEMO-NOV4.md) |

## Test Scenarios

- [ ] Counts before and after (AC2), written down without any personal data.
- [ ] The first sign-in screens (AC4).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0015](US0015-release-check-and-freeze-before-recording.md) | Process | The release check passed | Draft |
| [US0014](US0014-the-demo-account-reads-as-maya.md) | Process | The name and the Patel email, if Vi said yes | Draft |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* Deleted rows are not restorable; that is the point of the
reset, and it touches the demo account only.

## Open Questions

- [ ] DQ-1: reset on Nov 3 right before shot 3, never on Nov 4? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from docs/DEMO-NOV4.md and HANDOFF section 0a. Three Amigos lenses applied in-session by the author, not an independent review |
