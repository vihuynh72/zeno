# EP0004: Demo readiness for Nov 4

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** M
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Nov 4, must ship
> **Target Release:** Nov 4 demo (video due Nov 4, 6:00 PM PT)
> **Owner:** Claude (Vi for US0014)
> **Reviewer:** Vi
> **PRD:** B3, G4 (reminders off), I2 (the day-2 line), I4; [docs/DEMO-NOV4.md](../../docs/DEMO-NOV4.md) DQ-1 to DQ-3

## Summary

Everything the 3-minute video needs that the other Nov 4 epics do not cover. Four small changes Vi decides on:
reminders off on Zeno's calendar blocks, a direct tone, a soft Done sound, and day 2 naming what Zeno learned. Then a
demo account that reads as Maya, a release check with a freeze, and a clean reset right before the first-sign-in
shot.

**Goal:** record the four moments Vi chose, on production, with nothing scripted that the app does not really do.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| Brief §1 | Deadline | Video due Nov 4, 6:00 PM PT; production stable by the morning of Nov 4 | Everything lands on Nov 3; a freeze after the release check |
| CLAUDE.md, memory | Data | Never write test data to Vi's own account; the demo account only | The reset names the demo address only, and counts other rows before and after |
| DEMO-NOV4.md | Honesty | Never script a pattern Zeno did not find | Day 2 shows whatever day 1 really taught Zeno |
| Brief §8 | Trust | Tone never changes the trust rules | The tone change touches the persona lines only |

## Business Context

### Problem Statement

The demo plan ([docs/DEMO-NOV4.md](../../docs/DEMO-NOV4.md), "What must ship before recording") lists eight items.
Four are in EP0001 and EP0002. The other four are Vi's calls (OQ-2 to OQ-5), and the account itself has three open
questions (DQ-1 to DQ-3): when to reset, a draft with no To address, and a greeting that says "Hi De".

**What Vi said:** the video shows "knows me at sign-in; focus with Zeno; talk to Zeno; day 2 is smarter". On tone:
"straight to the point… I hate whenever it sugarcoats… pushes you to the right direction". Zeno's calendar items
"never notify (reminders off)". Done is rewarding: "DONE stamp + small sound".

### Value Proposition

- **With it:** each shot shows the real app doing what the narration says.
- **Without it:** a reminder can pop up mid-take, Zeno greets "Hi De", day 2 may not say what it learned, and a late
  change can break production on the day of the video.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Items in "What must ship before recording" live or dropped by Vi | 0 of 8 | 8 of 8 | The table in DEMO-NOV4.md, checked in US0015 |
| Takes lost to an app fault | Unknown | 0 | Vi's recording notes |

## Scope

### In Scope

- US0010: Zeno's calendar blocks never pop up a reminder (OQ-4).
- US0011: Zeno speaks directly by default (OQ-2).
- US0012: a soft sound with the DONE stamp, only with Sound on (OQ-3).
- US0013: on day 2, the opening names the pattern Zeno learned, once (OQ-5).
- US0014: the demo account reads as Maya and holds one real email from "Prof Patel" (DQ-2, DQ-3; Vi's actions).
- US0015: the release check on production, then the freeze (fixes only) until the video is in.
- US0016: the reset of the demo account on Nov 3, right before shot 3 (DQ-1).

### Out of Scope

- Shots 1, 2, 7 and 8 (made in the edit) and the edit itself.
- The tone setting (Gentle / Direct / Drill sergeant): Later, EP0013.
- Rewriting `docs/SUBMISSION.md`: DEMO-NOV4.md replaces its shot list once Vi approves it.
- The mission line and tagline (OQ-1): a words decision for the video, no app change.

### Affected Personas

- **Maya Torres (Primary):** she is the demo persona; every shot is her day.

## Acceptance Criteria (Epic Level)

- [ ] Every row of "What must ship before recording" in DEMO-NOV4.md is live on production or dropped by Vi.
- [ ] A Zeno block booked on camera never pops up a reminder.
- [ ] Zeno greets "Maya", and a draft to Prof Patel opens with a real To address.
- [ ] The demo account is reset on Nov 3, keeps Maya's calendar, mail and Canvas link, and day 1 survives to Nov 4.
- [ ] `main` takes fixes only from the release check until the video is submitted.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0001 | Epic | Draft | Claude |
| EP0002 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Vi's answers to OQ-1 to OQ-5 and DQ-1 to DQ-3 | Each code story here ships only on Vi's yes | Open |
| Google account settings (rename to Maya) and a second address Vi owns | US0014 is done in Google, by Vi | Open |
| EP0003 | Optional: the release check covers it only if it shipped | Draft |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| The video (Linear VI-317) | Deliverable | Due Nov 4, 6:00 PM PT |

## Risks & Assumptions

### Assumptions

- Day 1 on the demo account (Nov 3) gives Zeno enough real use for a pattern: at least 5 finished steps, most of them
  in the same part of the day (DEMO-NOV4.md).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| No pattern forms by Nov 4 | Medium | Medium | Show the instant card and the Memory list; narration stays general (DEMO-NOV4.md) |
| A Nov 4 item lands late | Medium | High | Record shot 3 right after the reset anyway; record shots 4 and 5 on Nov 4 morning after shot 6 (DEMO-NOV4.md) |
| The reset touches the wrong account | Low | High | The SQL names the demo address only; other accounts' row counts are compared before and after |
| The direct tone reads as harsh | Medium | Medium | Vi reads 10 sample lines before merge; blunt, never cruel or shaming |
| 37 Nov 4 points across four epics in one day | High | High | The cut order in the [epic index](_index.md) |

## Technical Considerations

### Architecture Impact

- Small code changes: `eventFor` in `src/lib/calendar.ts`, `ZENO_VOICE_PROMPT` in `src/lib/ai.ts`, a sound helper in
  `src/lib/speak.ts`, a "new since yesterday" line in the opening (`src/app/api/day/opening/route.ts`,
  `src/lib/agent.ts`).
- Operations: the demo account in Google, the Neon database and one Chrome profile.

### Integration Points

- Google Calendar API (reminders), Google account settings, Gmail (one incoming email), Neon (reset), Vercel
  (deploy and logs).

## Sizing

**Size:** M

**Estimated Story Count:** 7

**Derived Point Total:** 13

**Complexity Factors:**

- Four of the seven stories wait on Vi's answers.
- Order matters on Nov 3: code, release check, reset, then recording.

## Story Breakdown

- [ ] [US0010: Zeno's calendar blocks never pop up a reminder](../stories/US0010-zeno-s-calendar-blocks-never-pop-up-a.md)
- [ ] [US0011: Zeno speaks directly by default](../stories/US0011-zeno-speaks-directly-by-default.md)
- [ ] [US0012: A soft sound when a step is done](../stories/US0012-a-soft-sound-when-a-step-is-done.md)
- [ ] [US0013: On day 2 Zeno names what it learned, once](../stories/US0013-on-day-2-zeno-names-what-it-learned.md)
- [ ] [US0014: The demo account reads as Maya](../stories/US0014-the-demo-account-reads-as-maya.md)
- [ ] [US0015: Release check and freeze before recording](../stories/US0015-release-check-and-freeze-before-recording.md)
- [ ] [US0016: Reset the demo account right before shot 3](../stories/US0016-reset-the-demo-account-right-before-shot-3.md)

## Test Plan

- Self-checks: `node src/lib/calendar.check.ts`, `node src/lib/agent.check.ts`.
- The release check (US0015) is the manual test for the whole demo path on production.

## Open Questions

- [ ] OQ-1: the mission line and tagline for the video. Default: "Other AI does your work. Zeno gets you to do it." and
      "From 'I should' to 'I did.'" - Owner: Vi
- [ ] OQ-2: switch to the direct tone now? Default: yes. - Owner: Vi
- [ ] OQ-3: the soft Done sound for Nov 4? Default: yes, only with Sound on. - Owner: Vi
- [ ] OQ-4: reminders off on Zeno's blocks now? Default: yes. - Owner: Vi
- [ ] OQ-5: on day 2, Zeno names a newly learned pattern once? Default: yes. - Owner: Vi
- [ ] DQ-1: reset on Nov 3 right before shot 3, never on Nov 4? Default: yes. - Owner: Vi
- [ ] DQ-2: send one email to the demo account from a second address Vi owns, signed Prof Patel? Default: yes. -
      Owner: Vi
- [ ] DQ-3: rename the demo Google account's first name to Maya? Default: yes. - Owner: Vi
- [ ] The freeze: fixes only on `main` from the release check until the video is submitted? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief, docs/DEMO-NOV4.md and the code at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
