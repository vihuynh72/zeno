# EP0010: Zeno on the main calendar

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #6 of 12 (start Google's verification as soon as Vi approves)
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** G3, G4, G5, G6, L3; OQ-4, OQ-10, OQ-11

## Summary

With a broader Google permission and a new consent, Zeno writes to the person's main calendar instead of a separate
"Zeno" calendar. Its events use one distinct color and carry a tag at the start of the title: [Suggested], [Moved],
[Delayed] or [Postponed]. They never notify. Only big or time-set things go on the calendar (meetings, the gym, planned
commitments, big work blocks); Muse decides what is calendar-worthy, and small steps never go there. Before an exam,
Zeno reserves or suggests study time, quietly.

**Goal:** the person's own calendar shows Zeno's big blocks in one place, readable at a glance, and never pings.

## Business Context

### Problem Statement

Today Zeno writes only to its own "Zeno" calendar (the `calendar.app.created` scope), with a 10-minute popup on each
block. People have to think about a second calendar, and the popups break the "never notify" rule.
([PRD section G](../prd.md#g-calendar))

**What Vi said:** the calendar is for big or time-set things, never small steps: "writing all the small little goals…
might waste space". Zeno's events look distinct, not a separate "Zeno" calendar: "people don't want to think that
much". Autonomy: act on small things, ask before big ones (main calendar events, emails, anything other people see).

### Value Proposition

- **With it:** one calendar, Zeno's blocks clearly marked, nothing pings.
- **Without it:** a second calendar to toggle, and reminders nobody asked for.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Zeno events with a notification | Every timed block | 0 | Event reminders in the Google API |
| Small steps on the calendar | 0 (rule) | 0 | Blocks under 60 minutes not asked for |

## Scope

### In Scope

- A broader Google Calendar scope, with re-consent, and the main calendar as Zeno's target. (G3)
- One distinct color for Zeno's events.
- Tags at the start of titles: [Suggested], [Moved], [Delayed], [Postponed] (meanings: OQ-11); reminders off. (G4)
- Muse decides what is calendar-worthy: meetings, the gym, planned commitments, big work blocks. (G5)
- Exam prep: study time reserved or suggested, quietly; help with the material when asked. (G6)
- Autonomy: Zeno acts on small things (re-plan, reorder, rename, capture) and asks before big ones, including new
  events on the main calendar (L3; OQ-10 says where [Suggested] and [Moved] fall).

### Out of Scope

- Editing the person's own events without asking. Never (OQ-10 default).
- Editing inside the Do mode Week view: it stays read-only and opens Google.
- Calendars other than Google (Outlook comes with EP0014).

### Affected Personas

- **Daniel Okafor:** meetings and deep-work blocks on one calendar.
- **Rosa Delgado:** commitments (walks, pickups) that move quietly.
- **Maya Torres (Primary):** study time before an exam, without a second calendar.

## Acceptance Criteria (Epic Level)

- [ ] After re-consent, Zeno's events land on the main calendar in one distinct color.
- [ ] Every Zeno event title starts with its tag, and no Zeno event has a reminder.
- [ ] A new event on the main calendar takes one tap; Zeno moves only events it created.
- [ ] Small steps never appear on the calendar.
- [ ] Before an exam, Zeno suggests or reserves study time without a message, and helps only when asked.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Google OAuth verification for a sensitive Calendar scope | The app is unverified today (100 users at most); a broader scope makes verification stricter and takes weeks | Not started |
| EP0008 | Moves come from missed-work triage | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0007 | Epic | Dragging onto the main calendar in Plan mode |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Google's verification is slow or asks for changes | High | High | Start the request when Vi approves; build while it is pending |
| People are wary of an app writing to their main calendar | Medium | Medium | One tap for new events; tags and one color; Undo |
| Re-consent loses some people | Medium | Medium | Ask in context, the first time a block is booked |

## Technical Considerations

### Architecture Impact

- `src/auth.ts` scopes; `eventFor`, `insertBlock` and the Zeno-calendar logic in `src/lib/calendar.ts`.

## Sizing

**Size:** M

**Estimated Story Count:** 6

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] OQ-10: do [Suggested] events go on the main calendar without a tap, and may Zeno quietly move only events it
      created? Default: a new event takes one tap and is written as "[Suggested] …"; Zeno moves only its own events,
      quietly; never the person's own without asking. - Owner: Vi
- [ ] OQ-11: what each tag means. Default: [Moved] a new time the same day; [Postponed] another day; [Delayed] its due
      date moved (an extension); [Suggested] Zeno proposed it. - Owner: Vi
- [ ] Which color. Default: one Google event color, chosen with Vi. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
