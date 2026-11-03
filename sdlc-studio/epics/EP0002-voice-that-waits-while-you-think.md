# EP0002: Voice that waits while you think

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** S
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Nov 4, must ship (demo shot 5)
> **Target Release:** Nov 4 demo, on production before the Nov 3 reset (2 PM PT, DQ-1); after that only as a fix
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** J2

## Summary

Talk stops cutting people off. When a sentence sounds unfinished ("…and", "…because", "um"), Zeno keeps listening
for 3 more seconds instead of answering. A complete sentence or question still gets a quick answer. A "Done talking"
tap ends the turn at once.

**Goal:** Maya can think out loud. Zeno answers what she meant, not half of it.

## Inherited Constraints

| Source | Type | Constraint | Impact |
| --- | --- | --- | --- |
| Brief §8 | Platform | Keep Meta's transcription (Muse Voice Transcribe) for the hackathon | The fix lives in the browser, on top of the transcripts Meta already sends |
| PRD §5 | Performance | A complete question gets Zeno's first words in about 2.5 s; an unfinished sentence waits 3 s or more (OQ-8) | No added wait for a complete sentence |
| PRD §5 | Accessibility | Voice is optional; typing always works | The new tap is a normal button, reachable by keyboard |
| DESIGN.md | Design | The dot ring is the only voice indicator; one big button per screen | "Done talking" is a small link, not a second indicator |

## Business Context

### Problem Statement

Meta's realtime transcription (ENDPOINTING mode) ends a turn about 0.6 s after speech stops. `useVoice`
(`src/lib/use-voice.ts`) sends that text at once. So a 2-second thinking pause becomes a turn, and Zeno answers half a
sentence. ([PRD section J](../prd.md#j-voice-turn-taking))

**What Vi said:** "I pause two seconds… then the voice just interrupts me… leave space where people think." Wait longer
when the sentence sounds unfinished, reply quickly to a complete question, and give a tap for "done talking".

### Value Proposition

- **With it:** talking to Zeno feels like talking to a person who lets you finish. Shot 5 shows Zeno waiting through
  a pause.
- **Without it:** the video's talk moment risks Zeno cutting Vi off on camera.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Cut-offs in Vi's own test, by where the pause falls | Most of them | 0 when the pause comes after a joining word or "the"; the other places reported as they are | Vi says 10 natural sentences with a 2-second pause in different places: after "and", before "and", after a complete clause ("…next Thursday [pause] and I haven't started"), after "the". Claude writes down each result honestly |
| Complete question to Zeno's first words, no tool | About 1.3-2.4 s plus speech start | About 2.5 s or less (median of 10) | Stopwatch from the end of speech to the first sound |

## Scope

### In Scope

- A 3-second hold after a sentence that sounds unfinished (OQ-8 default). What comes next joins it as one turn.
- No added wait for a sentence that sounds complete.
- A "Done talking" link while Zeno listens. It sends what was heard at once.
- Both listeners: Meta's realtime one and the Web Speech fallback.
- Tuning the waits with Vi's own voice (OQ-8).

### Out of Scope

- Trying other realtime voice providers (PRD J3). Later; no epic yet (see the [epic index](_index.md)).
- Changes to the server relay (`src/lib/listen-relay.ts`, `src/app/api/listen/route.ts`).
- Talking over Zeno while it speaks. Tapping Talk or pressing Esc already interrupts it.

### Affected Personas

- **Maya Torres (Primary):** thinks out loud with ADHD pauses; the demo's talk moment.
- **Rosa Delgado:** talks to Zeno on her phone in short windows.

## Acceptance Criteria (Epic Level)

- [ ] A sentence ending in a joining word or a filler (or, on the Web Speech fallback, a trailing comma) keeps Zeno
      listening for 3 more seconds.
- [ ] Speaking again inside those 3 seconds joins the two parts into one turn.
- [ ] A complete sentence or question is sent at once, as today.
- [ ] "Done talking" sends what was heard at once; with nothing heard, it just stops listening.
- [ ] In Vi's test (10 natural sentences, the pause in different places), no pause after a joining word or "the" is
      cut off, the other results are written down as they are, and complete questions are answered in about 2.5 s.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| None | - | - | - |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| Vi's 10-sentence voice test (OQ-8) | The 3 s and 2.5 s numbers are tuned with Vi's real pauses | Open |
| A real microphone, and `npx vercel@65.7.0 dev --local` for local voice | Meta's relay needs the Vercel WebSocket route | Available |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0004 (US0015) | Epic | The release check tries a paused sentence on production before shot 5 |

## Risks & Assumptions

### Assumptions

- Meta's transcripts end on the last word spoken, so "…and" is visible at the end of the text. They come back
  lowercase and unpunctuated (tested Oct 29), so on Meta's listener only the word list can trigger a hold; the
  trailing-comma and "?" rules matter only on the Web Speech fallback.
- A held Web Speech recognition can restart without a new tap once the mic is allowed (Chrome allows it).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A complete sentence that ends in a listed word ("…for my mom") waits 3 s | Medium | Low | Short list of words that rarely end a sentence; Vi's test tunes it |
| Known miss: a pause right after a clause that sounds complete ("…next Thursday [pause] and I haven't started") is still sent at once | High | Medium | Written down in Vi's test, not hidden. The person keeps talking and it becomes the next turn (Zeno reads the last 12); holding every sentence would slow every complete question. "Done talking" ends a turn early when they finish sooner |
| Fillers ("um") never reach the transcript | Medium | Low | The joining words still catch most pauses |
| A hold makes the mic stay open longer | Low | Low | The 30-second listen limit still ends it, and sends the held words |

## Technical Considerations

### Architecture Impact

- A new pure module `src/lib/turn-taking.ts` (the "sounds unfinished" rule) with its self-check
  `src/lib/turn-taking.check.ts`, run with plain node.
- `useVoice` in `src/lib/use-voice.ts` holds an unfinished turn and gains a `finish()` method.
- The dock in `src/components/day-view.tsx` shows the "Done talking" link while listening.

### Integration Points

- Muse Voice Transcribe through the existing relay: `speechStart`, partial `transcript` and `speechComplete` events,
  already passed to the browser by `toClientEvent`.

## Sizing

**Size:** S

**Estimated Story Count:** 2

**Derived Point Total:** 5

**Complexity Factors:**

- Timing behaviour that only a real voice can prove.
- Two listeners (Meta and Web Speech) with different session lifetimes.

## Story Breakdown

- [ ] [US0006: Zeno keeps listening after an unfinished sentence](../stories/US0006-zeno-keeps-listening-after-an-unfinished-sentence.md)
- [ ] [US0007: A Done talking tap ends the turn at once](../stories/US0007-a-done-talking-tap-ends-the-turn-at.md)

## Test Plan

- Self-check: `node src/lib/turn-taking.check.ts`.
- Manual: a real microphone in Chrome, on `npx vercel@65.7.0 dev --local` and then production; Vi's 10-sentence test.

## Open Questions

- [ ] OQ-8: wait 3 s after an unfinished sentence, and answer a complete question in about 2.5 s? Claude tunes both
      with Vi's own test. - Owner: Vi
- [ ] Should tapping the Talk ring while listening also mean "done" (send) instead of "stop" (drop)? Default: keep
      today's stop, so there is still a way to cancel. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD, Vi's Nov 3 brief and the code at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: Vi's test uses 10 natural sentences with the pause in different places; Meta's transcripts are unpunctuated, so only the word list holds a turn; the known miss is written down; reset-time target |
