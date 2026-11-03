# US0012: A soft sound when a step is done

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/speak.ts, src/components/guided-day.tsx
> **Epic:** EP0004
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (ships only if Vi says yes to OQ-3)
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** a small, soft sound when I finish a step
**So that** finishing feels good and I want to do the next one

## Context

### Persona Reference

**Maya Torres** (Primary): "Quick and satisfying, short like a reel." [Full persona](../personas/maya-torres.md)

### Background

The brief: "Coming back is rewarding: DONE stamp + small sound, the goal's bar moves, the next step is ready." PRD
OQ-3's default: a short soft sound made in the browser (no file), only when Sound is on. Today Done shows the stamp
(`finishStep` in `src/components/guided-day.tsx`, and the spoken-done branch of `onUserTurn`) and speaks "Nice. Next:
…" when Sound is on. `src/lib/speak.ts` already owns the one `AudioContext` (`audioContext()`).

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §2 | Product | No alarms; quiet by default | Soft, short, once; only on Done |
| PRD §5 | Accessibility | No flashing or alarm-like cues | No loud or repeating sound |
| Sound setting | Product | Sound off means silence | Gated on `voice.muted` |

## Acceptance Criteria

### AC1: A soft sound with the stamp, Sound on

- **Given** Sound on (account menu) and Focus on a step
- **When** Maya taps Done and the save succeeds, or says "done" in talk and the stamp lands
- **Then** a short, soft two-note sound (under 300 ms in all) plays with the DONE stamp, made in the browser with Web
  Audio from `audioContext()` (no audio file), before "Nice. Next: …" is spoken
- **Caller:** `finishStep` and the spoken-done branch of `onUserTurn` in src/components/guided-day.tsx
- **Verified:** no

### AC2: Sound off is silent

- **Given** Sound off
- **When** a step is finished either way
- **Then** no sound plays
- **Caller:** `finishStep` in src/components/guided-day.tsx
- **Verified:** no

### AC3: Only on Done

- **Given** any other moment (Start, the check-in line, "Back.", a heads-up, a booking, Stop for now)
- **When** it happens
- **Then** this sound never plays: `playDone` is called only from `finishStep` and the spoken-done branch
- **Caller:** `finishStep` in src/components/guided-day.tsx
- **Verified:** no

### AC4: A failed save makes no sound

- **Given** Done tapped while the save fails (offline, signed out)
- **When** `finishStep` gets a non-ok answer
- **Then** no sound plays (the stamp is taken back, as today)
- **Caller:** `finishStep` in src/components/guided-day.tsx
- **Verified:** no

### AC5: Vi hears it and says yes

- **Given** the sound on production or a local build
- **When** Vi finishes a step with Sound on
- **Then** Vi approves the sound (or asks for another), before the release check
- **Caller:** `finishStep` in src/components/guided-day.tsx
- **Verified:** no

## Scope

### In Scope

- `playDone()` in `src/lib/speak.ts`; two calls in `src/components/guided-day.tsx`.

### Out of Scope

- Sounds anywhere else; a sound setting of its own (Sound covers it).

## Technical Notes

- `playDone()`: from `audioContext()`, two sine oscillators (for example 660 Hz then 880 Hz, about 90 ms each) through a
  gain node with about 10 ms attack, an exponential release, and a peak gain near 0.08. If the context is not running
  (the browser has not allowed audio yet), return quietly. Done always follows a tap, so this is rare.
- Call it right after a successful save, when the stamp shows, and only when `!voice.muted`.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Double tap on Done | One stamp, one sound (the second tap is ignored today) |
| Zeno is speaking when Done is tapped | The sound plays; the next line follows as today |
| The audio context is suspended | Nothing plays, no error |
| A milestone Done (bigger stamp) | The same sound, once |
| Reduced motion | Unchanged: sound is not motion |

## Test Scenarios

- [ ] Chrome, Sound on: Done plays the sound once; Sound off: silence.
- [ ] Chrome, offline: Done fails, no sound.
- [ ] `git grep -n playDone src` shows only the helper in `speak.ts` and its two calls in `guided-day.tsx` (AC3).
- [ ] Vi listens (AC5).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Done sound | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-3: the soft Done sound for Nov 4? Default: yes, only with Sound on. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
