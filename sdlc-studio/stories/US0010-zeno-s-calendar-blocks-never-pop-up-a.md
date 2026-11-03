# US0010: Zeno's calendar blocks never pop up a reminder

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/calendar.ts, src/lib/calendar.check.ts
> **Epic:** EP0004
> **Points:** 1
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (ships only if Vi says yes to OQ-4)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** the blocks Zeno books on my calendar to never pop up a reminder
**So that** Zeno never pings me, on camera or off

## Context

### Persona Reference

**Maya Torres** (Primary): "Timers that beep and apps that ping make her anxious, so she mutes them and then misses
things." [Full persona](../personas/maya-torres.md)

### Background

The brief: Zeno's items "never notify (reminders off)". Today `eventFor` in `src/lib/calendar.ts` gives timed blocks
`reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] }`, and all-day "Due:" events no
`reminders` at all (so the calendar's default applies). A block booked on camera in shot 5 would pop up later. PRD
OQ-4's default: turn them off now.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §6 | Product | Zeno's calendar items never notify | No popup, no email reminder, no default reminder |
| PRD G2 | Product | Writes only when asked or for 60+ minutes; one tap; Undo | Unchanged |

## Acceptance Criteria

### AC1: Timed blocks carry no reminder

- **Given** a step or to-do block with a start and end
- **When** `eventFor(block, timeZone)` builds the Google event
- **Then** it has `reminders: { useDefault: false, overrides: [] }`
- **Verify:** shell node src/lib/calendar.check.ts
- **Caller:** `insertBlock` in src/lib/calendar.ts, from `POST /api/calendar/book`
- **Verified:** no

### AC2: All-day "Due:" events carry no reminder either

- **Given** a deadline block with a date
- **When** `eventFor(block, timeZone)` builds the event
- **Then** it has the same `reminders: { useDefault: false, overrides: [] }`, so the calendar's defaults never apply
- **Verify:** shell node src/lib/calendar.check.ts
- **Caller:** `insertBlock` in src/lib/calendar.ts
- **Verified:** no

### AC3: Live: no notification

- **Given** a block booked from talk on production with the demo account
- **When** it is opened in Google Calendar
- **Then** its details show no notifications, and nothing pops up at its start
- **Caller:** src/app/api/calendar/book/route.ts
- **Verified:** no

### AC4: Blocks booked before stay as they are

- **Given** blocks booked before this change
- **When** this ships
- **Then** they are not rewritten (they keep their popup until undone); the demo reset (US0016) removes the demo's
- **Caller:** `insertBlock` in src/lib/calendar.ts (new bookings only)
- **Verified:** no

## Scope

### In Scope

- `eventFor` in `src/lib/calendar.ts` and its assertions in `src/lib/calendar.check.ts` (the one at the
  `reminders` line, plus a new one for the all-day event). The comment above `eventFor` loses "with a 10-minute popup".

### Out of Scope

- Title tags, colors and the main calendar: EP0010.
- Rewriting existing events.

## Technical Notes

- Google Calendar accepts `reminders: { useDefault: false, overrides: [] }` as "no reminders" on insert.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The person's calendar has default reminders | Not applied (`useDefault: false`) |
| Undo of a block | Unchanged (`DELETE /api/calendar/book/[eventId]`) |
| Booking several blocks at once | Each has no reminder |
| A booking from Stop for now (`laterBlock`) | No reminder |
| Calendar write not allowed | Unchanged: "Let Zeno add to your calendar" in the account menu |

## Test Scenarios

- [ ] `node src/lib/calendar.check.ts` with the updated and new assertions.
- [ ] Production: book a block on the demo account; Google Calendar shows "No notifications" (AC3).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 1
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| New bookings | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-4: turn reminders off on Zeno's blocks now? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
