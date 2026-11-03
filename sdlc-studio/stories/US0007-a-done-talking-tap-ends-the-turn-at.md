# US0007: A Done talking tap ends the turn at once

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/use-voice.ts, src/components/day-view.tsx, src/components/guided-day.tsx, src/app/preview/gallery.tsx
> **Epic:** EP0002
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** a "Done talking" tap that sends what I said right away
**So that** I never have to wait out a pause when I know I'm finished

## Context

### Persona Reference

**Maya Torres** (Primary): "Quick and satisfying, short like a reel." [Full persona](../personas/maya-torres.md)

### Background

The brief asks for "a tap for 'done talking'". Today, while Zeno listens, the dock shows the Talk ring (labelled
"Listening, tap to stop") over the links Type · Today · Memory (`src/components/day-view.tsx`). Tapping the ring calls
`talk()` in `src/components/guided-day.tsx`, which stops listening and drops what was heard. A capture-phase
`pointerdown` listener in `guided-day.tsx` stops listening on any tap that is not on an element marked `data-answer`
or `data-talk`.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| DESIGN.md | Design | One big button per screen; other actions are small links; the dot ring is the only voice indicator | "Done talking" is a small link in the dock, not a new indicator |
| DESIGN.md | Accessibility | Tap targets 44 px or taller; keyboard reachable | Uses the existing `link` class and a `button` |

## Acceptance Criteria

### AC1: The link shows only while Zeno listens

- **Given** the dock
- **When** Zeno is listening (`voice.phase === "listening"`)
- **Then** a "Done talking" link shows first in the dock's link row, in Ink and bold (the `data-lead` style), as a
  `button` with the `link` class and `data-talk`; in every other phase it is not there
- **Verify:** grep "Done talking" src/components/day-view.tsx
- **Caller:** the dock in src/components/day-view.tsx
- **Verified:** no

### AC2: A tap sends what was heard, at once

- **Given** Zeno listening, with words heard (a partial transcript, or words on hold from US0006)
- **When** Maya taps "Done talking"
- **Then** those words go at once as one voice turn (no hold, no wait), and Zeno answers as usual; hands-free goes on as
  today after a question
- **Caller:** `voice.finish()` in src/lib/use-voice.ts, called from `on.doneTalking` in src/components/guided-day.tsx
- **Verified:** no

### AC3: With nothing heard, it just stops

- **Given** Zeno listening with nothing heard yet
- **When** Maya taps "Done talking"
- **Then** listening ends exactly as a stop does today (hands-free ends too)
- **Caller:** `voice.finish()` in src/lib/use-voice.ts
- **Verified:** no

### AC4: The tap is not mistaken for "tap elsewhere"

- **Given** hands-free listening
- **When** Maya taps "Done talking"
- **Then** the capture-phase `pointerdown` guard does not stop the listen first (the link carries `data-talk`), so the
  heard words are sent, not dropped
- **Caller:** the hands-free `pointerdown` effect in src/components/guided-day.tsx
- **Verified:** no

### AC5: The ring keeps its meaning

- **Given** Zeno listening
- **When** Maya taps the Talk ring
- **Then** it stops and drops the words, as today, so there is still a way to cancel (an open question for Vi)
- **Caller:** `talk()` in src/components/guided-day.tsx
- **Verified:** no

## Scope

### In Scope

- `finish()` in the object `useVoice` returns.
- The dock link and a new `on.doneTalking()` in `DayViewProps`.
- The `hands-free` sample in `/preview` shows the link.

### Out of Scope

- The hold itself: US0006.
- Changing what the ring does: kept as today unless Vi says otherwise.

## Technical Notes

- `src/lib/use-voice.ts`: `finish()` reads the current partial (and US0006's held words), then `halt()`s; with text,
  `turn(text, "voice")`; without, `silent()`.
- `src/components/day-view.tsx`: in the dock's `.links`, render the link before Type when `voice.phase ===
  "listening"`, with its middle dot after it.
- `src/components/guided-day.tsx`: `doneTalking: () => voice.finish()` in the `on` props.
- `src/app/preview/gallery.tsx`: the `hands-free` sample already sets `phase: "listening"`.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Tapped twice fast | The second tap finds the phase is no longer listening; nothing happens |
| Tapped as Meta's final arrives | One turn only: whichever comes first sends, and the other finds the phase changed |
| Mic blocked | Zeno never listens, so the link never shows; Type is the way, as today |
| Keyboard user | Tab reaches the link; Enter or Space sends |
| A phone at 390 px | Checked in `/preview`: the four dock links fit or wrap cleanly, and each keeps a 44 px tap target |

## Test Scenarios

- [ ] The grep in AC1 passes.
- [ ] `/preview?state=hands-free` at 1440x900 and 390 px, light and dark: the link shows first, in Ink.
- [ ] Chrome with a mic: say "Put the lab report", tap "Done talking": one turn at once.
- [ ] Chrome: tap "Done talking" before speaking: listening stops, nothing is sent.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0006](US0006-zeno-keeps-listening-after-an-unfinished-sentence.md) | Code | The held words `finish()` also sends (without US0006, it sends the partial only) | Draft |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Dock link | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] Should tapping the ring while listening also mean "done" (send) instead of "stop" (drop)? Default: keep stop. -
      Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
