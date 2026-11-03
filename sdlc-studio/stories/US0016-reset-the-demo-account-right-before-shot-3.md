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
Nov 3 at a fixed cut-off (2 PM PT by default), whether or not every Nov 4 item has shipped, then record shot 3, then
use Zeno for real for the rest of Nov 3, and record shot 6 on Nov 4 morning without a reset. A fixed time matters: day
1 needs at least 5 real finished steps, 60% of them in one part of the day, before 10 PM (`patternsIn` in
`src/lib/patterns.ts`; after 10 PM counts as "late at night"), and a reset on Nov 3 evening would leave almost no day 1.

The reset steps (HANDOFF section 0a, "The demo account now"), with one change from later notes: keep the
`zeno.canvas.<account>` key so Canvas stays connected. Sign out through the account menu would delete that key
(`signOut` in `src/components/guided-day.tsx` removes every `zeno.vault.*` and `zeno.canvas.*` key), so shot 3 starts
signed out by deleting only Zeno's session cookie.

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
- **Then** the vault, the saved day, the scanned mark (and the heard list, if US0013 shipped) are gone; Canvas is still
  linked (US0014 re-linked it after the rename; the `zeno.canvas.<account>` key is there and the account menu shows
  Canvas as connected); and Sound is turned on in the account menu
- **Caller:** n/a
- **Verified:** no

### AC4: The next sign-in is a first sign-in

- **Given** AC1 to AC3 done, and the take started signed out by deleting only Zeno's Auth.js session cookie in Chrome
  DevTools (Application → Cookies → names starting with `__Secure-authjs.session-token`), never through Sign out in the account menu
- **When** the demo account signs in with Google and opens Zeno
- **Then** it shows "Reading your calendar and email…", then the line of what it found and [Start my day], with
  Canvas still linked; this is shot 3, recorded right away
- **Caller:** n/a
- **Verified:** no

### AC5: On Nov 3 at the cut-off

- **Given** the cut-off (Nov 3, 2 PM PT by default, DQ-1), or the release check (US0015) passing before it
- **When** the reset is done, at whichever comes first
- **Then** it happens on Nov 3, never on Nov 4, so day 1 (Nov 3's real use, 5 or more finished steps before 10 PM)
  survives for shot 6; an item that lands after the reset ships as a fix, and shots 4 and 5 follow DEMO-NOV4.md's
  fallback
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

- Order on Nov 3: US0014 by noon (name, Patel email, sign in again, re-link Canvas) → US0015 (release check and freeze)
  → this reset at 2 PM PT, or as soon as US0015 passes if that is earlier → shot 3 → shots 4 and 5 (if their items are
  live) → real use until 10 PM.
- The `user_state` row holds the Zeno calendar's id; deleting it is fine: on the next booking, `ensureZenoCalendar`
  (`src/lib/calendar.ts`) finds the existing "Zeno" calendar in the account's list, or makes one.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| An undo fails | Retry once; if it still fails, delete that event in Google Calendar by hand |
| The SQL count for another account changed | Stop; investigate before going on (it must never happen) |
| The Canvas key is gone (removed by mistake, or someone used Sign out in the account menu) | Vi reconnects Canvas from the account menu before shot 3 (Vi pastes the token; agents never type tokens) |
| The scan finds nothing on first sign-in | It retries on the next open; "Paste notes" is the backup (DEMO-NOV4.md) |
| The Nov 4 items are late | Reset at the cut-off anyway and record shot 3; the items ship as fixes; record shots 4 and 5 on Nov 4 morning after shot 6 (DEMO-NOV4.md) |

## Test Scenarios

- [ ] Counts before and after (AC2), written down without any personal data.
- [ ] The first sign-in screens (AC4).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0015](US0015-release-check-and-freeze-before-recording.md) | Process | The release check passed, or the cut-off came first | Draft |
| [US0014](US0014-the-demo-account-reads-as-maya.md) | Process | The name, the Patel email and Canvas re-linked, if Vi said yes | Draft |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* Deleted rows are not restorable; that is the point of the
reset, and it touches the demo account only.

## Open Questions

- [ ] DQ-1: reset on Nov 3 at 2 PM PT (or right after the release check, if it passes sooner), whether or not every
      item shipped, right before shot 3, and never on Nov 4? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from docs/DEMO-NOV4.md and HANDOFF section 0a. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: a fixed cut-off (Nov 3, 2 PM PT, DQ-1) whether or not every item shipped; shot 3 signs out by deleting only the session cookie, so Canvas stays linked; AC3 checks the link |
