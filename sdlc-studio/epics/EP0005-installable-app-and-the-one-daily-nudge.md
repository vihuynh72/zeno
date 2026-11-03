# EP0005: Installable app and the one daily nudge

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #2 of 13 (the brief: "PWA now")
> **Target Release:** After the Nov 9 live final, built on a branch with a preview deploy before then (OQ-20: or before Nov 4)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** K2, A8; OQ-9, OQ-20, OQ-22; Outcomes ("Making them measurable")

## Summary

Zeno installs to the phone's home screen and the computer's dock, opens straight to the card, and gets one quiet way
to reach people: about one opt-in notification a day. This is the brief's "PWA now (installable, notifications)". It
also brings two small things the installed app makes urgent: reopening Zeno during a step goes back to Focus with the
time still counting, and the daily "opened" mark that the success measures need.

**Goal:** Zeno is one tap away on the phone, without an app store, and nudges about once a day.

## Business Context

### Problem Statement

Today Zeno lives in a browser tab. Maya and Rosa live on their phones. A tab gets lost; an app icon stays. The brief
also says nudges are rare: "very few. About once a day, or when something is critical (due today, an exam tomorrow)
or about long-term goals. 'Normally I don't want to have it nudging you constantly.'" There is no channel for that
nudge yet. Phones also close background tabs, and today a reload shows the card and restarts the stopwatch on Start.
And three of the four success measures cannot be computed yet: nothing records the days a person opened Zeno.
([PRD section K](../prd.md#k-platforms))

### Value Proposition

- **With it:** a quiet presence on the home screen, one place for the daily nudge and the Sunday check-up (EP0006),
  and a step that survives the phone closing the tab.
- **Without it:** Zeno is easy to forget, the weekly check-up only shows when someone happens to open it, and the
  outcomes stay unmeasured.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| People back on 8 of their first 14 days (O3) | Not measured | 50% or more (proposed, OQ-15) | The once-a-day "opened" mark this epic adds (no tracking outside Zeno) |
| Notifications per person per day | 0 | About 1; never more than 2 (OQ-9) | Server count of sent notifications |

## Scope

### In Scope

- A web app manifest, icons from the Z mark, and opening full screen to the card.
- A small service worker: the app shell loads offline and shows the last saved card.
- Opt-in notifications after one explicit tap, with the budget from PRD principle 3 (proposed, OQ-9): one nudge a day
  at the person's local nudge hour, carrying the most important thing (critical first: due today, an exam tomorrow);
  a second only when something critical comes up after it, so never more than two; a long-term goal rides in the
  daily nudge or the Sunday line, never a push of its own.
- What a notification says: never a title, so nothing private or health-related reaches a lock screen (a course quiz
  can be named after a condition, OQ-17). For example "One thing is due today. Open Zeno."
- The person's time zone, saved on the server each time `/api/day` answers (today it lives only in the browser's `tz`
  cookie), so the daily job knows each person's "today" and local hour.
- Canvas in nudges: the server sees Canvas only when the browser that holds the link syncs. A Canvas item counts for a
  nudge only if a sync that same day still showed it unsubmitted, so Zeno never nudges about work already handed in.
- Where the Sunday check-up appears (OQ-9).
- Reopening Zeno during a step (a reload, or a phone that closed the tab) goes straight back to Focus, the stopwatch
  still counting from the step's saved start (A8, OQ-22). Today Start on a running step saves a new start time
  (`changeStepStatus` in `src/lib/goals.ts`, `withStatus` in `src/components/day-flow.ts`).
- Measuring the outcomes (one small story): a once-a-day "opened" mark per account and local date, written by
  `/api/day`; an opaque account key (the same kind as the browser cache's, never an email) on every "Model call" log
  line; and the stress measure once Vi answers OQ-16.

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
- [ ] One nudge a day at the person's local nudge hour; a second only for something critical that came up after it;
      never more than two; never for check-ins, calendar events or missed work.
- [ ] A critical item (due today, an exam tomorrow) is never held back by the daily budget: it takes the daily nudge,
      or the second one if it came up later.
- [ ] No notification text names a step, goal, course or deadline.
- [ ] A person in Tokyo and a person in Los Angeles each get their nudge at their own local hour (a check with a
      fixed clock, as `day-flow` and `week-grid` already do).
- [ ] No nudge mentions a Canvas item unless a sync that day still showed it unsubmitted.
- [ ] Turning notifications off takes one tap in the account menu.
- [ ] Reopening Zeno the same day while a step runs shows Focus with the time still counting; on a later day, the
      card (OQ-22 default).
- [ ] Each account gets at most one "opened" row per local date, and every "Model call" log line carries an opaque
      account key, never an email.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0006 | Epic | The Sunday check-up and long-term-goal lines use this channel (or show in the app until it exists) |
| EP0012 | Epic | Sharing into Zeno needs the installed app |
| EP0013 | Epic | Its "back on most days" measure reads the "opened" mark |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| iPhone web push works only for installed web apps (iOS 16.4 or later) | High | Medium | Ask to allow only after install; in-app line otherwise |
| A cached old app shell after a deploy | Medium | Medium | The shell is fetched from the network first; the cache is only the offline fallback |
| A step left running for days reopens into Focus | Medium | Low | Only the same local day; later, the card |

## Technical Considerations

### Architecture Impact

- `app/manifest` and icons in `public/`, a service worker, and a push subscription stored per account (a new table).
- The person's IANA time zone in `user_state`, saved by `/api/day`.
- A job that runs every hour (Vercel cron) and sends only to people whose local nudge hour it is; at most one pick
  per person per run. Dates and times through `src/lib/tz.ts` (the server runs in UTC).
- An `opened` table: one row per account and local date (`INSERT … ON CONFLICT DO NOTHING`).
- On load, `GuidedDay` opens Focus when the saved goal's first open step is running and started that local day;
  Start on a running step keeps its start time.

## Sizing

**Size:** M

**Estimated Story Count:** 6

**Complexity Factors:**

- Web push differs by platform.
- A scheduled job that must respect each person's time zone.

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Why this comes early

It is small, the brief says "PWA now", and it settles how the daily nudge and the Sunday check-up reach people
before EP0006 builds them. It also makes the outcomes measurable before more features land.

## Open Questions

- [ ] OQ-9: how nudges reach people, and how many. Default: in the app until the PWA; then opt-in, one a day at the
      local nudge hour (critical first), a second only for something critical that came up after it, a long-term
      goal riding in the daily nudge or the Sunday line, no titles on a lock screen. - Owner: Vi
- [ ] OQ-20: build the PWA before Nov 4 instead? Default: no; right after the video, shipped after the Nov 9 final. -
      Owner: Vi
- [ ] OQ-22: reopening Zeno during a step. Default: back to Focus the same day; the card on a later day. - Owner: Vi
- [ ] What counts as critical? Default: due today, or an exam tomorrow. - Owner: Vi
- [ ] The local nudge hour. Default: 9 AM in the person's time zone. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: the nudge budget matches PRD principle 3 (one a day, a second only for something critical, never more than two); time zone saved for the daily job; no titles on a lock screen; Canvas nudges only after a same-day sync; measuring the outcomes and resuming Focus after a reload added; #2 of 13 |
