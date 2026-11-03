# US0009: The browser reuses its saved opening

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Affects:** src/components/guided-day.tsx
> **Epic:** EP0003
> **Points:** 2
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval
> **Owner:** Claude
> **Reviewer:** Vi
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** the browser to keep the opening it already has when the server says nothing changed, and to stop asking
twice
**So that** the card and its line stay put and are ready at once

## Context

### Persona Reference

**Maya Torres** (Primary): "the first moment must feel instant". [Full persona](../personas/maya-torres.md)

### Background

In `src/components/guided-day.tsx` the saved day (`Saved`, kept under `zeno:day`) holds `opening: Opening | null` for
one part of the day (`part`). On load:

- `early`: if a saved day exists, `fetchOpening(null)` is sent at once, with no device facts and no Canvas briefs
  (the account is not confirmed yet).
- After `/api/day` answers, `reuse` keeps `early` only when the person has no device facts (`vaultTexts`) and no
  Canvas link; otherwise a second `fetchOpening(mine)` goes out and the first answer is thrown away.
- `onOpening` swaps the model's line in and says it once.

US0008 gives each model opening a `key` and answers `{ state: "same" }` when `since` matches.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| PRD §5 | Performance | The card on screen in 200 ms or less | The saved card still paints first; nothing waits longer than today |
| PRD L1 | Privacy | The early call sends no device facts (the account is not confirmed yet) | Deciding to skip it only reads local storage; nothing is sent |
| Browser storage | Reliability | Storage can be blocked | With no saved opening, no `since`: the model path, as today |

## Acceptance Criteria

### AC1: The key is kept with the model's opening

- **Given** an `ok` opening with a `key`
- **When** `onOpening` stores it
- **Then** the saved `Opening` is `{ text, options, pick, key }`; an opening without a key (a rule line) is stored with
  no key
- **Caller:** `onOpening` in src/components/guided-day.tsx
- **Verified:** no

### AC2: Opens send `since`; re-plans do not

- **Given** a saved day for the same account and the same part of the day, with a keyed opening
- **When** the page loads
- **Then** the opening request carries `since` = that key; `refreshOpening` (Pick the next thing, a Canvas change) and
  the opening after first sign-in send no `since`
- **Caller:** `fetchOpening` in src/components/guided-day.tsx
- **Verified:** no

### AC3: "Same" keeps the saved opening

- **Given** the server answers `{ state: "same" }`
- **When** `onOpening` handles it
- **Then** the saved line, tap answers and pick stay on screen with no flicker (a pick that no longer fits the goal is
  dropped by `pickFits`, as today), the line is said once as today when Sound is on, and Start is ready when
  `/api/day` answers, as today; if no saved opening is left, the rule line shows, as on an error
- **Caller:** `onOpening` in src/components/guided-day.tsx
- **Verified:** no

### AC4: No early call whose answer would be thrown away

- **Given** a saved day whose account has device facts (`vaultTexts(account).length > 0`) or a Canvas link
  (`readCanvas(account)`)
- **When** the page loads
- **Then** no early opening request is sent; one request goes out after `/api/day` answers, as `reuse` would have
  required anyway
- **Caller:** the load effect in src/components/guided-day.tsx
- **Verified:** no

### AC5: Measured on production

- **Given** the demo account (device facts and Canvas) on production, nothing changed between loads
- **When** the page is reloaded twice in the same part of the day
- **Then** the second load makes no "Model call" from `/api/day/opening` in Vercel's runtime logs (today: two per load)
- **Caller:** `fetchOpening` in src/components/guided-day.tsx, answered by src/app/api/day/opening/route.ts
- **Verified:** no

## Scope

### In Scope

- `Opening.key`, `fetchOpening(account, since?)`, the `same` branch in `onOpening`, and the early-call condition, all
  in `src/components/guided-day.tsx`.

### Out of Scope

- The server: US0008.
- Any change to when the line is spoken (once per load, Sound on, as today).

## Technical Notes

- `type Opening = { text: string; options: string[]; pick: FirstPick | null; key?: string }`; `Saved.v` stays 3 (a new
  optional field needs no version bump).
- `fetchOpening(account, since?)` adds `since` to the POST body only when given.
- In the load effect: `early` is made only when `saved && (!saved.day.isNew || saved.setupDone) &&
  vaultTexts(saved.day.account).length === 0 && !readCanvas(saved.day.account)`; it sends `since` from the saved
  opening when `saved.part === part`. The later call sends `kept?.key`.
- In `onOpening`: treat `same` like `ok` with `cache.current.opening`'s text, options and pick; when that is null,
  fall back as for an error.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The saved opening is from another part of the day | No `since`; the model path |
| The saved day is another account's | No `since` (`onDay` drops it, as today) |
| `same` arrives after Maya already tapped something | Ignored, as any late opening is (`moved`) |
| Private window, storage blocked | No saved opening, so no `since`; as today |
| The server is on an older build without `same` | It ignores `since` and answers `ok`; nothing breaks |
| A saved pick no longer fits the goal | Dropped by `pickFits`; the line stays |

## Test Scenarios

- [ ] Chrome DevTools, a test account with no device facts: reload twice; the second opening answer is `same`.
- [ ] Chrome DevTools, the demo account (device facts and Canvas): one opening request per load, none before
      `/api/day`.
- [ ] Production: Vercel runtime logs show "Opening reused" and no "Model call" for the second load (AC5).
- [ ] Tap "Pick the next thing": a fresh model opening (no `since`).

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| [US0008](US0008-the-opening-skips-the-model-when-nothing-changed.md) | API | `key` on openings and the `same` answer | Draft |

## Estimation

**Points:** 2
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** true

| Component | Reversal | Expected time |
| --- | --- | --- |
| Opening requests | Revert the merge commit on `main`; Vercel redeploys | About 2 minutes |

## Open Questions

- [ ] On a reload with nothing changed, should Zeno say the same line again (once per load, Sound on, as today)?
      Default: no: the line stays on screen unspoken, which also saves the voice cost (PRD §5; asked in EP0003). -
      Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story against `main` at `7adcddb`. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fix: the reload question's default is now not to speak an unchanged line again (saves the voice cost) |
