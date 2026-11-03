# US0014: The demo account reads as Maya

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Epic:** EP0004
> **Points:** 1
> **Persona:** Maya Torres
> **Approval:** Draft, awaiting Vi's approval (DQ-2 and DQ-3 are Vi's calls; Vi acts in Google, Claude checks)
> **Owner:** Vi
> **Reviewer:** Claude
> **Estimated-by:** Claude (Opus 5.5)
> **Serves:** Maya Torres

## User Story

**As a** Maya Torres
**I want** Zeno to greet me by my name and to draft my email to Prof Patel with his real address
**So that** the demo shows my day as it would really look

## Context

### Persona Reference

**Maya Torres** (Primary): the demo persona. [Full persona](../personas/maya-torres.md)

### Background

From HANDOFF section 0, known issues: "Maya's 8 emails are self-sent, so every sender reads 'De Bruyne' and a draft to
Prof Patel has no To address (Zeno never guesses one)", and Zeno greets "Hi De" because the demo Google account's name
is De Bruyne. The greeting uses the first word of `session.user.name` (from Google at sign-in). `draft_email` in
`talk()` (`src/lib/agent.ts`) keeps a To address only when it matches a sender in the person's recent mail.
DEMO-NOV4.md asks DQ-2 and DQ-3.

## Inherited Constraints

| Source | Type | Constraint | AC Implication |
| --- | --- | --- | --- |
| CLAUDE.md, memory | Data | Never Vi's own account; the demo account only | Changes are made in the demo account only |
| Brief §6 | Trust | Zeno never sends mail | The draft opens in Gmail; Vi presses Send only if the shot needs it |

## Acceptance Criteria

### AC1: The greeting says Maya (DQ-3), and Canvas is linked again

- **Given** Vi renamed the demo Google account's first name to Maya (Google Account → Personal info → Name)
- **When** the demo account signs out of Zeno and signs in again (the session takes the name at sign-in)
- **Then** Zeno's greeting uses "Maya"; and because Sign out in the account menu removes the Canvas link from this
  browser (it deletes every `zeno.vault.*` and `zeno.canvas.*` key: `signOut` in src/components/guided-day.tsx), Vi
  re-links Canvas right away (account menu → Connect Canvas, Vi pastes the token; agents never type tokens), before the
  release check (US0015) and the reset (US0016)
- **Caller:** the opening (`firstName` from `session.user.name` in src/app/api/day/opening/route.ts)
- **Verified:** no

### AC2: A real Prof Patel email (DQ-2)

- **Given** one email sent to the demo account from a new mailbox made only for the demo, with the display name
  "Prof. Patel" and a subject about CS 146 office hours (never one of Vi's own addresses: the To field shows it on
  camera in shot 5)
- **When** Vi says "Draft an email to Professor Patel asking about office hours"
- **Then** Gmail's compose window opens with To set to that address
- **Caller:** `draft_email` in `talk()`, src/lib/agent.ts
- **Verified:** no

### AC3: Nothing else changes

- **Given** the two changes above
- **When** the demo account is checked
- **Then** Maya's calendar events and her earlier emails are unchanged, and no code changed
- **Caller:** n/a
- **Verified:** no

## Scope

### In Scope

- A name change in the demo Google account; one incoming email from a new mailbox made only for the demo; re-linking
  Canvas after the new sign-in.

### Out of Scope

- Code changes. None.
- Sending any email from Zeno. Never.
- Any of Vi's own addresses or accounts on camera. Never.

## Technical Notes

- Order on Nov 3, by noon (DEMO-NOV4.md, "Vi's Nov 3"): rename, send the Patel email, sign out and in, re-link Canvas.
  All of it before the release check (US0015) and the 2 PM reset (US0016), so shot 3's first sign-in already says Maya
  and Canvas is linked.
- Signing out through the account menu clears this browser's Canvas link and vault on purpose (a shared computer must
  not keep them). The reset (US0016) keeps the Canvas key; shot 3 signs out by deleting only the session cookie.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The old session still says "De" | Sign out of Zeno and in again, then re-link Canvas |
| Canvas shows as not connected after the new sign-in | Expected after Sign out: Vi pastes the token again in Connect Canvas |
| The Patel email lands in Promotions or Updates | Move it to Primary; the inbox shows only people and school |
| Vi prefers not to rename the account | Keep "Hi De" and cut the greeting in the edit (DEMO-NOV4.md fallback) |
| No demo mailbox yet | The draft opens with an empty To; narration skips the address |
| The scan learns a fact from the Patel email | Fine: it is a real school contact for the demo |

## Test Scenarios

- [ ] After the rename and a new sign-in, the opening greets Maya.
- [ ] After re-linking, the account menu shows Canvas as connected.
- [ ] The draft request opens compose with the Patel address in To, and that address is the demo-only mailbox.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Vi's answers to DQ-2 and DQ-3 | Decision | Open |
| A new mailbox made only for the demo (display name "Prof. Patel") | Account | Open |
| The Canvas token, pasted by Vi | Account | Open |

## Estimation

**Points:** 1
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* To undo, rename the account back and delete the email.

## Open Questions

- [ ] DQ-2: send one email to the demo account from a new mailbox made only for the demo, display name "Prof. Patel"
      (never one of Vi's own addresses: it shows in the To field on camera)? Default: yes. - Owner: Vi
- [ ] DQ-3: rename the demo Google account's first name to Maya? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from docs/DEMO-NOV4.md and HANDOFF section 0. Three Amigos lenses applied in-session by the author, not an independent review |
| 2026-11-03 | Claude | Review fixes: re-link Canvas after signing out and in (Sign out clears the Canvas key); the Patel email comes from a new demo-only mailbox, never Vi's own address |
