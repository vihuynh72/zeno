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
> **PRD:** B3, G4 (reminders off), I2 (the day-2 line), I4; [docs/DEMO-NOV4.md](../../docs/DEMO-NOV4.md) DQ-1 to DQ-5

## Summary

Everything the 3-minute video and the Nov 9 live final need that the other Nov 4 epics do not cover. Four small
changes Vi decides on: reminders off on Zeno's calendar blocks, a direct tone, a soft Done sound, and day 2 naming
what Zeno learned. Then a demo account that reads as Maya, a release check with a freeze that lasts through the live
final, a clean reset at a fixed time on Nov 3 right before the first-sign-in shot, and a live-demo check before the
final.

**Goal:** record the four moments Vi chose, on production, with nothing scripted that the app does not really do, and
keep the same app working for the judges through Nov 9.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| Brief §1 | Deadline | Video due Nov 4, 6:00 PM PT; production stable by the morning of Nov 4 | Everything lands on Nov 3 before the 2 PM PT reset (DQ-1); a freeze after the release check |
| Hackathon notes | Judging | Judging Nov 4-8; the live final is Nov 9; the demo score (25%) counts live robustness | The freeze runs through Nov 9 (DQ-4); a live-demo check before the final (US0017) |
| CLAUDE.md, memory | Data | Never write test data to Vi's own account; the demo account only | The reset names the demo address only, and counts other rows before and after |
| DEMO-NOV4.md | Honesty | Never script a pattern Zeno did not find | Day 2 shows whatever day 1 really taught Zeno |
| Brief §8 | Trust | Tone never changes the trust rules | The tone change touches the persona lines and the opening's question line only |

## Business Context

### Problem Statement

The demo plan ([docs/DEMO-NOV4.md](../../docs/DEMO-NOV4.md), "What must ship before recording") lists eight items.
Four are in EP0001 and EP0002. The other four are Vi's calls (OQ-2 to OQ-5), and the recording has five open
questions (DQ-1 to DQ-5): when to reset, a draft with no To address, a greeting that says "Hi De", how long the freeze
lasts, and the account's state for the Nov 9 live final.

**What Vi said:** the video shows "knows me at sign-in; focus with Zeno; talk to Zeno; day 2 is smarter". On tone:
"straight to the point… I hate whenever it sugarcoats… pushes you to the right direction". Zeno's calendar items
"never notify (reminders off)". Done is rewarding: "DONE stamp + small sound".

### Value Proposition

- **With it:** each shot shows the real app doing what the narration says.
- **Without it:** a reminder can pop up mid-take, Zeno greets "Hi De", day 2 may not say what it learned, and a late
  change can break production on the day of the video or while judges try it.

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
- US0014: the demo account reads as Maya and holds one real email from "Prof Patel", sent from a mailbox made only
  for the demo (DQ-2, DQ-3; Vi's actions).
- US0015: the release check on production, then the freeze (fixes only) through the Nov 9 live final (DQ-4).
- US0016: the reset of the demo account on Nov 3 at a fixed time (2 PM PT by default), right before shot 3 (DQ-1).
- US0017: a live-demo check before the Nov 9 final, and the account's state for it (DQ-5).

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
- [ ] The demo account is reset on Nov 3 at the cut-off, keeps Maya's calendar, mail and Canvas link, and day 1
      survives to Nov 4.
- [ ] `main` takes fixes only from the release check through the Nov 9 live final; Later work waits on branches with
      preview deploys.
- [ ] Before the Nov 9 final, the demo path passes again on production (US0017).

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0001 | Epic | Draft | Claude |
| EP0002 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Vi's answers to OQ-1 to OQ-5 and DQ-1 to DQ-5 | Each code story here ships only on Vi's yes | Open |
| Google account settings (rename to Maya) and a new mailbox made only for the demo | US0014 is done in Google, by Vi | Open |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| The video (Linear VI-317) | Deliverable | Due Nov 4, 6:00 PM PT |

## Risks & Assumptions

### Assumptions

- Day 1 on the demo account (Nov 3, from the 2 PM reset to 10 PM) gives Zeno enough real use for a pattern: at least
  5 finished steps, 60% of them in one part of the day (afternoon is noon to 5 PM, evening 5 PM to 10 PM; after 10 PM
  counts as late at night).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| No pattern forms by Nov 4 | Medium | Medium | Show the instant card and the Memory list; narration stays general (DEMO-NOV4.md) |
| A Nov 4 item lands late | Medium | High | The reset happens at the cut-off anyway and shot 3 is recorded right after; the late item ships as a fix; shots 4 and 5 move to Nov 4 morning after shot 6 (DEMO-NOV4.md) |
| The reset touches the wrong account | Low | High | The SQL names the demo address only; other accounts' row counts are compared before and after |
| The direct tone reads as harsh | Medium | Medium | Vi reads 10 sample lines before merge; blunt, never cruel or shaming |
| Signing out through the account menu removes the Canvas link | High | Medium | US0014 re-links Canvas after the rename; shot 3 signs out by deleting only the session cookie (DEMO-NOV4.md) |
| A Later epic reaches production during judging | Medium | High | The freeze through Nov 9 (DQ-4); Later work on branches with preview deploys |
| 32 points on Nov 3 across three epics | High | High | The cut order in the [epic index](_index.md) |

## Technical Considerations

### Architecture Impact

- Small code changes: `eventFor` in `src/lib/calendar.ts`, `ZENO_VOICE_PROMPT` in `src/lib/ai.ts` and the opening's
  question line in `openingPrompt` (`src/lib/agent.ts`), a sound helper in `src/lib/speak.ts`, a "new since
  yesterday" line in the opening (`src/app/api/day/opening/route.ts`, `src/lib/agent.ts`).
- Operations: the demo account in Google, the Neon database and one Chrome profile.

### Integration Points

- Google Calendar API (reminders), Google account settings, Gmail (one incoming email), Neon (reset), Vercel
  (deploy and logs).

## Sizing

**Size:** M

**Estimated Story Count:** 8

**Derived Point Total:** 15 (13 on Nov 3; US0017 runs on Nov 8 or 9)

**Complexity Factors:**

- Four of the eight stories wait on Vi's answers.
- Order matters on Nov 3: code, release check, the 2 PM reset, then recording.

## Story Breakdown

- [ ] [US0010: Zeno's calendar blocks never pop up a reminder](../stories/US0010-zeno-s-calendar-blocks-never-pop-up-a.md)
- [ ] [US0011: Zeno speaks directly by default](../stories/US0011-zeno-speaks-directly-by-default.md)
- [ ] [US0012: A soft sound when a step is done](../stories/US0012-a-soft-sound-when-a-step-is-done.md)
- [ ] [US0013: On day 2 Zeno names what it learned, once](../stories/US0013-on-day-2-zeno-names-what-it-learned.md)
- [ ] [US0014: The demo account reads as Maya](../stories/US0014-the-demo-account-reads-as-maya.md)
- [ ] [US0015: Release check and freeze before recording](../stories/US0015-release-check-and-freeze-before-recording.md)
- [ ] [US0016: Reset the demo account right before shot 3](../stories/US0016-reset-the-demo-account-right-before-shot-3.md)
- [ ] [US0017: Live-demo check before the Nov 9 final](../stories/US0017-live-demo-check-before-the-nov-9-final.md)

## Test Plan

- Self-checks: `node src/lib/calendar.check.ts`, `node src/lib/agent.check.ts`.
- The release check (US0015) is the manual test for the whole demo path on production.

## Open Questions

- [ ] OQ-1: the mission line and tagline for the video. Default: "Other AI does your work. Zeno gets you to do it."
      with "Built on Meta's Muse." under it, and "From 'I should' to 'I did.'" - Owner: Vi
- [ ] OQ-2: switch to the direct tone now? Default: yes. - Owner: Vi
- [ ] OQ-3: the soft Done sound for Nov 4? Default: yes, only with Sound on. - Owner: Vi
- [ ] OQ-4: reminders off on Zeno's blocks now? Default: yes. - Owner: Vi
- [ ] OQ-5: on day 2, Zeno names a newly learned pattern once? Default: yes. - Owner: Vi
- [ ] DQ-1: reset on Nov 3 at 2 PM PT (or right after the release check, if it passes sooner), whether or not every
      item shipped; never on Nov 4? Default: yes. - Owner: Vi
- [ ] DQ-2: send one email to the demo account from a new mailbox made only for the demo, display name "Prof. Patel"
      (never one of Vi's own addresses: it shows in the To field on camera)? Default: yes. - Owner: Vi
- [ ] DQ-3: rename the demo Google account's first name to Maya? Default: yes. - Owner: Vi
- [ ] DQ-4: the freeze: fixes only on `main` from the release check through the Nov 9 live final? Default: yes. -
      Owner: Vi
- [ ] DQ-5: the demo account for the Nov 9 live final. Default: no reset; show the live path from the card, and the
      first sign-in from the video. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief, docs/DEMO-NOV4.md and the code at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: the freeze runs through the Nov 9 final (DQ-4); US0017 checks the live demo before it (DQ-5); the reset has a fixed 2 PM cut-off (DQ-1); the Patel email comes from a demo-only mailbox (DQ-2); the Canvas link survives sign-out; 32 points on Nov 3 |
