# US0006: Zeno keeps listening after an unfinished sentence

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/lib/use-voice.ts, src/lib/turn-taking.ts, src/lib/turn-taking.check.ts
> **Epic:** EP0002
> **Points:** 3
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to keep listening when I pause in the middle of a sentence
**So that** it answers what I meant, not the first half of it

## Context

### Persona Reference

**Maya Torres** (Primary): thinks out loud, with pauses. [Full persona](../personas/maya-torres.md)

### Background

Vi: "I pause two seconds… then the voice just interrupts me… leave space where people think." The brief: wait longer
when the sentence sounds unfinished, reply quickly to a complete question, a tap for "done talking" (US0007). Keep
Meta's transcription for the hackathon.

Today Muse Voice Transcribe runs in ENDPOINTING mode (`relayToMeta` in `src/lib/listen-relay.ts`) and sends
`speechComplete` about 0.6 s after speech stops. In `useVoice` (`src/lib/use-voice.ts`), `listenNow()`'s `onFinal`
pauses the session and calls `turn(text, "voice")` at once. Web Speech (`listenWeb` in `src/lib/listen.ts`, the
fallback) runs with `continuous = false`, so it ends after one utterance and calls `onFinal` from `onend`.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| Brief §8 | Platform | Keep Meta's transcription for the hackathon | The rule works on the transcript text Meta already sends |
| PRD §5, OQ-8 | Performance | Unfinished: wait 3 s or more; complete: first words in about 2.5 s | 3000 ms hold only for unfinished text; 0 ms otherwise |
| PRD §5 | Accessibility | Typing always works | Typed turns are never held |

## Acceptance Criteria

### AC1: The rule: does it sound unfinished?

- **Given** the pure function `holdMs(text)` in the new src/lib/turn-taking.ts (`HOLD_MS = 3000`, OQ-8 default)
- **When** it is called with "I have the CS 146 exam next Thursday and", "…next Thursday and…", "so, um", "Because",
  "I want to start with the", "Put the study time on my calendar", "What should I do first?", "Yes", "and?" and ""
- **Then** it returns 3000, 3000, 3000, 3000, 3000, 0, 0, 0, 0 and 0. Unfinished means: the text ends with ",", "…",
  "...", "-" or ":", or its last word (lowercased, trailing punctuation dropped) is one of: and, but, or, so, because,
  cause, then, plus, um, uh, er, erm, hmm, like, a, an, the, to, of, for, with, from, into, at, about, if, when, while,
  since, until, that, which, my, your, our, their. A text ending in "?" is complete.
- **Verify:** shell node src/lib/turn-taking.check.ts
- **Caller:** `onFinal` in `listenNow()`, src/lib/use-voice.ts
- **Verified:** no

### AC2: An unfinished sentence keeps Zeno listening

- **Given** Talk is listening
- **When** a final transcript arrives that sounds unfinished ("I have the CS 146 exam next Thursday and")
- **Then** Zeno stays in the listening phase (the ring keeps its listening arc), the words stay on screen, nothing is
  sent, and the mic stays open (Meta: the session is not paused; Web Speech: a new recognition starts)
- **Caller:** `useVoice` in src/lib/use-voice.ts
- **Verified:** no

### AC3: Speaking again joins the two parts

- **Given** an unfinished sentence on hold
- **When** Maya speaks again within the 3 seconds ("I haven't started")
- **Then** the hold timer stops at her first sound (`onSpeechStart` or the first partial), and the next final is joined
  with a space: "I have the CS 146 exam next Thursday and I haven't started" goes as one turn (or is held again if it
  too sounds unfinished)
- **Caller:** `useVoice` in src/lib/use-voice.ts
- **Verified:** no

### AC4: Silence after the hold sends what was said

- **Given** an unfinished sentence on hold
- **When** 3 seconds pass with no new speech
- **Then** the held words go as one voice turn; nothing is dropped
- **Caller:** `useVoice` in src/lib/use-voice.ts
- **Verified:** no

### AC5: A complete sentence goes at once

- **Given** Talk is listening
- **When** a final transcript arrives that does not sound unfinished
- **Then** it is sent at once with no added wait, as today; in Vi's test (OQ-8), a complete question that needs no tool
  gets Zeno's first words in about 2.5 s or less (median of 10 tries)
- **Caller:** `useVoice` in src/lib/use-voice.ts
- **Verified:** no

### AC6: The 30-second limit and typing

- **Given** words on hold when the 30-second listen limit (`LISTEN_LIMIT_MS`) fires, or a typed message
- **When** the limit fires, or the typed message is submitted
- **Then** the held words are sent instead of dropped; a typed message is never held
- **Caller:** `useVoice` in src/lib/use-voice.ts
- **Verified:** no

## Scope

### In Scope

- `src/lib/turn-taking.ts` (pure: `HOLD_MS`, `holdMs`) and `src/lib/turn-taking.check.ts` (plain node, asserts).
- The hold in `useVoice`'s `listenNow()`: a held string and a hold timer.
- Vi's 10-sentence voice test to tune `HOLD_MS` and the word list (OQ-8).

### Out of Scope

- The "Done talking" tap: US0007.
- The server relay and Meta's endpointing settings.
- Other voice providers (PRD J3, Later).

## Technical Notes

- In `listenNow()` (src/lib/use-voice.ts): keep `held = ""` and `holdTimer`.
  - `onSpeechStart` (new in the handlers object; both adapters already call it) and `onPartial`: clear `holdTimer`;
    show `held + " " + partial` as the partial.
  - `onFinal(text)`: `joined = [held, text.trim()].filter(Boolean).join(" ")`. If `holdMs(joined) > 0`: `held =
    joined`, show it, `session?.resume()` (a no-op for Meta when not paused; a new recognition for Web Speech), and set
    `holdTimer` to send `held` after `holdMs(joined)`. Otherwise clear `held`, clear the listen-limit timer, pause the
    session and `turn(joined, "voice")`, as today.
  - The listen-limit timeout sends `held` when it is not empty, else calls `silent()` as today.
  - `halt()` clears `held` and `holdTimer`.
- An unfinished final with empty text never happens (`holdMs("")` is 0, and an empty final already goes to
  `silent()`).

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| Meta's session rotates (close code 4000) during a hold | The relay reconnects as today; the held words stay; the timer keeps running |
| The tab is hidden during a hold | `listenMeta` ends the session ("no-speech"), so the held words are dropped, as an unsent listen is today |
| Tapping the Talk ring during a hold | Stops listening and drops the held words, as today's stop |
| Sound off | The hold still applies: it is about listening, not speaking |
| Web Speech cannot restart (an error) | The held words are sent at once |
| Hands-free listening after Zeno's question | The same rule |
| A one-word answer "and" | Held 3 s, then sent |

## Test Scenarios

- [ ] `node src/lib/turn-taking.check.ts` asserts the ten cases in AC1.
- [ ] Chrome with a real mic (`npx vercel@65.7.0 dev --local`, then production): "I have the CS 146 exam next
      Thursday and…", a 2-second pause, "…I haven't started." gives one turn.
- [ ] Same, with a 4-second pause: two turns (the first sent after 3 s).
- [ ] "What should I do first?" is answered with no added wait.
- [ ] Vi's own test: 10 paused sentences, 0 cut off; 10 complete questions, median first words about 2.5 s or less.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

## Estimation

**Points:** 3
**Complexity:** Medium

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Voice turn-taking | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] OQ-8: 3 s after an unfinished sentence, and about 2.5 s to answer a complete question? Tuned with Vi's test. -
      Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
