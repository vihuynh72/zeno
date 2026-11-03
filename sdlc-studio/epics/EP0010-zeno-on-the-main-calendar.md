# EP0010: Zeno on the main calendar

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #4 of 13 (moved up: Vi said no to a separate "Zeno" calendar, so Plan mode and the drafted week need this first)
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** G3, G4, G5, G6, L3; OQ-4, OQ-10, OQ-11

## Summary

With a broader Google permission and a new consent, Zeno writes to the person's main calendar instead of a separate
"Zeno" calendar. Its events use one distinct color and carry a tag at the start of the title: [Suggested], [Moved],
[Delayed] or [Postponed]. They never notify. Only big or time-set things go on the calendar (meetings, the gym, planned
commitments, big work blocks); Muse decides what is calendar-worthy, and small steps never go there. Before an exam,
Zeno offers study time quietly, and one tap reserves it. Every write still takes one tap.

**Goal:** the person's own calendar shows Zeno's big blocks in one place, readable at a glance, and never pings.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| Brief §6 | Autonomy | "ask before big ones (main calendar events, emails, anything other people see)" | A new event on the main calendar takes one tap |
| Meta's rules for Muse (acceptable use) | Platform | Confirm consequential actions such as calendar writes | Every write takes one tap, a move included (OQ-10); exam study time is offered, never written quietly |
| PRD §5 Security, Scalability | Security | The Google access token stays on the server; Google's verification is needed past 100 users for the whole app | A live check of the token before the scope changes (Blocked By); one verification request for the whole app |

## Business Context

### Problem Statement

Today Zeno writes only to its own "Zeno" calendar (the `calendar.app.created` scope), with a 10-minute popup on each
block. People have to think about a second calendar, and the popups break the "never notify" rule.
([PRD section G](../prd.md#g-calendar))

**What Vi said:** the calendar is for big or time-set things, never small steps: "writing all the small little goals…
might waste space". Zeno's events look distinct, not a separate "Zeno" calendar: "people don't want to think that
much". Autonomy: act on small things, ask before big ones (main calendar events, emails, anything other people see).
Exam prep: "reserve or suggest study time, quietly". Since Meta's rules ask for a confirmation before a calendar write,
"quietly" here means inline and never a notification, and "reserve" takes one tap (OQ-10 asks Vi).

**Why it moved up (to #4):** Vi said no to a separate "Zeno" calendar. EP0006's drafted week and EP0007's drag to
schedule would otherwise be built on it, so this epic now comes before Plan mode.

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
- Exam prep: study time offered inline before an exam, never as a notification; one tap reserves it as
  "[Suggested] …"; help with the material when asked. (G6)
- Autonomy: Zeno acts on small things (re-plan, reorder, rename, capture) and asks before big ones. Every write to the
  main calendar takes one tap: a new event, and a move of an event Zeno created (offered the next time they open
  Zeno). The plan inside Zeno still moves quietly. (L3; OQ-10)
- The drafted week's big blocks (EP0006) and Plan mode's drag to schedule (EP0007) write here, each with one tap.

### Out of Scope

- Editing the person's own events without asking. Never (OQ-10 default).
- Any write without a tap, exam study time included (Meta's rules; OQ-10).
- Editing inside the Do mode Week view: it stays read-only and opens Google.
- Calendars other than Google (Outlook comes with EP0014).

### Affected Personas

- **Daniel Okafor:** meetings and deep-work blocks on one calendar.
- **Rosa Delgado:** commitments (walks, pickups) that move with one tap when her plan changes.
- **Maya Torres (Primary):** study time before an exam, without a second calendar.

## Acceptance Criteria (Epic Level)

- [ ] After re-consent, Zeno's events land on the main calendar in one distinct color.
- [ ] Every Zeno event title starts with its tag, and no Zeno event has a reminder.
- [ ] Every write to the main calendar takes one tap: a new event, and a move of an event Zeno created. Zeno never
      moves the person's own events.
- [ ] Small steps never appear on the calendar.
- [ ] Before an exam, Zeno offers [Suggested] study time inline, with no notification; nothing is written until one
      tap. It helps with the material only when asked.
- [ ] Before the broader scope is asked for, a signed-in `GET /api/auth/session` on production shows no
      `accessToken`.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| A live check that the Google access token never reaches the browser. Since Oct 29 the session route cuts it (`withoutAccessToken`, `src/lib/session-json.ts`), but HANDOFF section 0 still lists it as readable; the check settles it before any permission grows | Check | Not done | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Google's verification for the whole app | Needed past 100 users whether or not this epic ships: `gmail.readonly` is already a restricted scope (Google's restricted-scope review with a security assessment). The broader calendar scope is a sensitive one and joins that same request; it limits how many people can use the epic, not when it can be built | Not started (its own item in the [epic index](_index.md)) |
| EP0008 | Moves come from missed-work triage; this epic builds the one-tap write they use | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0007 | Epic | Dragging onto the main calendar in Plan mode |
| EP0006 | Epic | The drafted week's big blocks reach the calendar only through this epic |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Google's verification is slow or asks for changes | High | High | One request for the whole app, started before growth; build and test with up to 100 users meanwhile |
| A one-tap move feels like a chore after a slip | Medium | Low | The plan already moved quietly; the move is one tap, offered once, and can be ignored |
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

- [ ] OQ-10: [Suggested], [Moved] and exam prep on the main calendar. Vi said "reserve or suggest study time,
      quietly" and that missed work "quietly moves", but also "ask before big ones (main calendar events)", and Meta's
      rules ask apps to confirm calendar writes. Default: every write takes one tap, offered inline, never as a
      notification: a new event (exam study time included) is written as "[Suggested] …"; a move of an event Zeno
      created is offered the next time they open Zeno; the plan inside Zeno moves quietly; never the person's own
      events. - Owner: Vi
- [ ] OQ-11: what each tag means. Default: [Moved] a new time the same day; [Postponed] another day; [Delayed] its due
      date moved (an extension); [Suggested] Zeno proposed it. - Owner: Vi
- [ ] Which color. Default: one Google event color, chosen with Vi. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: moved up to #4 of 13 (Vi said no to a separate Zeno calendar); every write takes one tap under Meta's rules, exam study time included (OQ-10); verification described correctly (gmail.readonly is already restricted); a live token check before the scope grows |
