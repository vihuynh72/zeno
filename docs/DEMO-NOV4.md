# Zeno: the Nov 4 demo video

**Status:** Draft, awaiting Vi's approval. Once approved, it replaces the shot list in `docs/SUBMISSION.md`.
**Due:** Nov 4, 6:00 PM PT. **Length:** 3:00. **Account:** the demo account dotcainha@gmail.com only, never Vi's own.
**Spec:** `sdlc-studio/prd.md` (feature ids like A3 and open questions like OQ-2 point there).

## The line

- **Mission line (recommended, PRD OQ-1):** "Other AI does your work. Zeno gets you to do it."
- **Tagline, on the last frame:** "From 'I should' to 'I did.'"
- **Optional opener:** Zeno's paradox (you never arrive, because half the way is always left), answered at the end:
  small steps add up, and you do arrive.

## The story and the four moments

Vi's story, in four beats, carries Vi's four moments:

| Story beat (Vi) | Moment (Vi) | Shots |
| --- | --- | --- |
| Today's chaos in the AI age: AI does work for you, but it's harder to see your goals or know what to do next | - | 1-2 |
| One card | Knows me at sign-in | 3 |
| It stays with you | Focus with Zeno; talk to Zeno | 4-5 |
| Day 2 | Day 2 is smarter | 6 |

Shots 7-8 cover how it's built (Meta AI use is 25% of judging) and the close.

## Shot list

### 1. 0:00-0:10 · Opener: the paradox (optional)

- **On screen:** a blank index card. Words appear on its rules: "To get anywhere, first go half the way. Then half of
  what's left. Then half again."
- **Say:** "Zeno's paradox: to get anywhere, you first go half the way. Then half again. You never arrive."
- **App must do:** nothing (made in the edit). If cut, give the 10 seconds to shot 4.

### 2. 0:10-0:25 · The chaos in the AI age

- **On screen:** fast cuts of the demo account's real screens: Canvas's to-do list, a full Google Calendar week, the
  Gmail inbox, an AI chat tab writing an essay.
- **Say:** "That's work in the AI age. AI can write your essay in seconds. But Canvas, your calendar and your inbox
  all shout at once, and you still don't know what to do first."
- **App must do:** nothing in Zeno. The demo account already holds Maya's classes (ENVS 119, CS 146, POLS 15, PHIL 134,
  CS 47), her 8 emails and a connected Canvas. Show Canvas lists, never grades.

### 3. 0:25-0:50 · Moment 1: knows me at sign-in (one card)

- **On screen:** Sign in with Google → "Reading your calendar and email…" (cut the wait) → "I read your calendar and
  email and learned N things, including N deadlines." [Start my day] → the wall from shot 2 folds into one card, for
  example "Outline claim 2 · 15 min · PHIL 134 paper · due Fri" with [Start · 15 min].
- **Say:** "Zeno reads your calendar, your email and Canvas, and turns all of it into one card: the next small step."
- **App must do:** the first sign-in scan, its one line, and a first card with Start, picked from real deadlines
  including Canvas (H2, H4, D1).
- **Today:** Live. Verified on production Nov 2. The fold into one card is an edit effect.

### 4. 0:50-1:30 · Moment 2: focus with Zeno (it stays with you)

- **On screen:** tap Start → a stopwatch counting up from 0:00 with "of 15 min" in grey → Music: lo-fi → cut to
  Google Docs, typing → back to Zeno's tab: "Back. 6 min on 'Outline claim 2'." → later the soft check-in line on the
  card → Done → the DONE stamp → "Nice. Next: Find two quotes for claim 2, 10 min" [Keep going] and the streak row.
- **Say:** "Tap Start. No alarm, no pings. Zeno just stays with you. Wander off, come back, and it knows where you
  were. Done, and the next step is already waiting."
- **App must do:**
  - A3 stopwatch, counting up, planned time in grey, no alarm. **Today: not yet** (a countdown).
  - A4 one visual check-in line at a moment Muse picks. **Today: not yet** (spoken "Halfway there.").
  - A5 the "Back." greeting from the tab's visibility only. **Today: not yet.**
  - Music, the DONE stamp, the next step, the streak. **Today: Live.**
  - B3 a small Done sound. **Today: not built** (OQ-3).
- **Shoot tip:** pick a short step, or record the whole step and cut, so the check-in appears on camera.

### 5. 1:30-2:05 · Moment 3: talk to Zeno

- **On screen:** tap Talk. Vi says: "I have the CS 146 exam next Thursday and… [a two-second pause] …I haven't
  started." Zeno waits through the pause, then answers with a plan. Vi: "Put the study time on my calendar." → one tap
  [Book] → "Booked." Vi: "Draft an email to Professor Patel asking about office hours." → Gmail's compose window opens
  with the draft. Vi: "Just write the paper for me." → Zeno: no, and here is the first step.
- **Say (over the end):** "Or just talk. Zeno waits while you think, plans the exam, books the time you asked for, and
  drafts the email for you to send. Ask it to do your work, and it gets you started instead."
- **App must do:**
  - J2 turn-taking: wait through a pause, answer a complete question fast, a "Done talking" tap. **Today: not yet**
    (it can cut in after about 2 seconds).
  - Planning by talk, a block when asked, the Gmail draft, the refusal. **Today: Live.**
  - I4 a direct tone. **Today: "warm, candid friend"** (OQ-2).
- **Known issue:** Maya's emails are self-sent, so the draft to Prof Patel opens with no To address (DQ-2).

### 6. 2:05-2:35 · Moment 4: day 2 is smarter

- **On screen:** a title card, "Next morning". Zeno opens and the card is there at once. Zeno's line names what it
  learned, for example "You get more done before noon, so the hard one first." Then Memory → "Patterns Zeno noticed":
  for example "Works best in the morning."
- **Say:** "Day two. Zeno noticed when you actually get things done, and plans around it. It learns from what you do,
  not from questions."
- **App must do:** a pattern saved from day 1 (I2), the instant card (A1), and Zeno saying the new pattern once (OQ-5).
- **Today:** the pattern and the Memory list are Live. Zeno saying it is **not guaranteed** (patterns save silently;
  OQ-5). Patterns need real use on day 1: at least 5 finished steps, with 60% of them in one part of the day, or 4
  timed steps for "Steps take you less time than you plan." Say whatever Zeno actually learned; never script a
  pattern it did not find.

### 7. 2:35-2:52 · How it's built with Meta AI

- **On screen:** a simple diagram on an index card: Muse Spark (picks the card, plans the steps, tool calls, strict
  JSON, minimal reasoning for speed) · Muse Voice Transcribe (realtime, through a WebSocket relay on Vercel) · Muse web
  search (sources for a step) · private facts stay on the device.
- **Say:** "Built on Meta's Muse. Muse Spark plans and decides with tool calls. Muse Voice Transcribe hears you in real
  time. And private things never leave your device."
- **App must do:** nothing new. Every claim is true at `e716f09`. After Nov 4's items ship, it is also true that Muse
  picks each step's check-in moment.

### 8. 2:52-3:00 · Close

- **On screen:** the Z mark, "Other AI does your work. Zeno gets you to do it.", "From 'I should' to 'I did.'", and
  zeno-sigma-topaz.vercel.app.
- **Say:** "Other AI does your work. Zeno gets you to do it."
- **App must do:** nothing.

## What must ship before recording

| Item | PRD | Needed in shot | Today |
| --- | --- | --- | --- |
| Stopwatch, planned time in grey, no alarm | A3 | 4 | Not built (countdown) |
| One visual check-in per step | A4 | 4 | Not built (spoken lines) |
| "Back." greeting, own tab only | A5, L2 | 4 | Not built |
| Voice waits while you think; "Done talking" tap | J2 | 5 | Not built |
| Direct tone | I4, OQ-2 | 5 | Vi's call |
| Small Done sound | B3, OQ-3 | 4 | Vi's call |
| Reminders off on Zeno's blocks | G4, OQ-4 | 5 (a block booked on camera would pop up later) | Vi's call |
| Zeno says the day-2 pattern once | I2, OQ-5 | 6 | Vi's call |

## Recording plan

The catch: shot 3 needs a freshly reset account, and shot 6 needs a real day 1 on that same account. `HANDOFF.md`
says to reset the demo account on the morning of Nov 4; that would erase day 1 (DQ-1). Proposed order:

1. **Nov 3, once A3, A4, A5 and J2 are on production:** reset the demo account (keep Maya's 18 events, her 8 emails and
   the `zeno.canvas.<account>` key so Canvas stays connected). Turn Sound on in the account menu. Record shot 3, then
   shots 4 and 5.
2. **Nov 3, the rest of the day:** use Zeno for real on the demo account. Finish at least 5 steps, most of them in the
   same part of the day. Do not seed fake history.
3. **Nov 4 morning, no reset:** record shot 6. Shots 1, 2, 7 and 8 are made in the edit. Upload, check the link in a
   private window, and submit before 6 PM PT.

**If the Nov 4 items land late:** record shot 3 right after the reset anyway (it needs none of them), and record shots
4 and 5 on Nov 4 morning after shot 6.

**Freeze (proposal):** once the Nov 4 items are live, only fixes go to `main` until the video is done.

## Before every take

- Chrome at 1440x900, zoom 100%, bookmarks bar hidden, other tabs closed, Do Not Disturb on.
- Signed in as the demo account. Never show Vi's own Google account or the Canvas token.
- Sound on (it is off in that Chrome). A quiet room and the real microphone for shot 5.
- On a reload, wait about 3 seconds for the card's Start (known issue) before tapping.

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| The first scan is slow (9-13 s) | Cut the wait. If it finds nothing, it retries on the next open; "Paste notes" is the backup |
| Voice mishears or cuts in | Retake. Typing works but shows less |
| No pattern formed by Nov 4 | Show the instant card and the Memory list; keep the narration general |
| The draft has no To address | DQ-2 |
| Zeno greets "Hi De" (the Google name is De Bruyne) | DQ-3 |

## Decisions for Vi

- **DQ-1. When to reset the demo account.** Default: Nov 3, right before shot 3. Not on Nov 4.
- **DQ-2. The Gmail draft's To address.** Default: send one email to the demo account from a second address Vi owns,
  signed as Prof Patel, so the draft has a real To.
- **DQ-3. The greeting name.** Default: rename the demo Google account's first name to Maya.
- Also from the PRD, before Nov 4: OQ-1 (the line), OQ-2 (tone), OQ-3 (sound), OQ-4 (reminders), OQ-5 (day-2 line),
  OQ-6 (heads-ups), OQ-7 (when "Back." shows), OQ-8 (voice timings).
