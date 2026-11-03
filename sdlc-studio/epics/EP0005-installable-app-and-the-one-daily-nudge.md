# EP0005: Installable app and the one daily nudge

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** S
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #1 of 12
> **Target Release:** Right after Nov 4 (OQ-9)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** K2; OQ-9

## Summary

Zeno installs to the phone's home screen and the computer's dock, opens straight to the card, and gets one way to
reach people: at most one opt-in notification a day. This is the brief's "PWA now (installable, notifications)".

**Goal:** Zeno is one tap away on the phone, without an app store, and nudges at most once a day.

## Business Context

### Problem Statement

Today Zeno lives in a browser tab. Maya and Rosa live on their phones. A tab gets lost; an app icon stays. The brief
also says nudges are rare: "About once a day, or when something is critical (due today, an exam tomorrow) or about
long-term goals. 'Normally I don't want to have it nudging you constantly.'" There is no channel for that one nudge
yet. ([PRD section K](../prd.md#k-platforms))

### Value Proposition

- **With it:** a quiet presence on the home screen, and one place for the daily nudge and the Sunday check-up (EP0006).
- **Without it:** Zeno is easy to forget, and the weekly check-up only shows when someone happens to open it.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| People back on 8 of their first 14 days (O3) | Not measured | 50% or more (proposed, OQ-15) | A once-a-day "opened" mark per account (no tracking outside Zeno) |
| Notifications per person per day | 0 | 1 at most, opt-in | Server count of sent notifications |

## Scope

### In Scope

- A web app manifest, icons from the Z mark, and opening full screen to the card.
- A small service worker: the app shell loads offline and shows the last saved card.
- Opt-in notifications after one explicit tap: at most one a day, for the daily nudge, something critical (due today,
  an exam tomorrow) or a long-term goal.
- Deciding where the Sunday check-up appears (OQ-9).

### Out of Scope

- Notifications for check-ins, calendar events or missed work. Never (brief §2, §4, §6).
- Native iPhone and Mac apps: EP0015, EP0016.
- Sharing into Zeno from other apps (the share sheet): EP0012 builds it on this install.

### Affected Personas

- **Rosa Delgado:** her phone is her computer most days.
- **Maya Torres (Primary):** her phone is with her between classes.
- **Daniel Okafor:** the dock icon on his laptop.

## Acceptance Criteria (Epic Level)

- [ ] Zeno installs from Safari on iPhone, Chrome on Android and Chrome on a laptop, and opens to the card.
- [ ] With no network, the installed app opens and shows the last saved card.
- [ ] No notification is ever sent before the person taps to allow it.
- [ ] At most one notification per person per day, and never for check-ins, calendar events or missed work.
- [ ] Turning notifications off takes one tap in the account menu.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0006 | Epic | The Sunday check-up and long-term-goal nudges use this channel (or show in the app until it exists) |
| EP0012 | Epic | Sharing into Zeno needs the installed app |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| iPhone web push works only for installed web apps (iOS 16.4 or later) | High | Medium | Ask to allow only after install; in-app line otherwise |
| A cached old app shell after a deploy | Medium | Medium | The shell is fetched from the network first; the cache is only the offline fallback |

## Technical Considerations

### Architecture Impact

- `app/manifest` and icons in `public/`, a service worker, and a push subscription stored per account (a new table).
- A daily job picks at most one nudge per person (Vercel cron).

## Sizing

**Size:** S

**Estimated Story Count:** 4

**Complexity Factors:**

- Web push differs by platform.

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Why this is first after Nov 4

It is small, the brief says "PWA now", and it settles how the one daily nudge and the Sunday check-up reach people
before EP0006 builds them.

## Open Questions

- [ ] OQ-9: when does the PWA ship, and do nudges show in the app or as a notification? Default: right after Nov 4;
      in the app until then; after it, at most one opt-in notification a day. - Owner: Vi
- [ ] What counts as critical? Default: due today, or an exam tomorrow. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
