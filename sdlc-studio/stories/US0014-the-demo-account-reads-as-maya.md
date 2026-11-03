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

### AC1: The greeting says Maya (DQ-3)

- **Given** Vi renamed the demo Google account's first name to Maya (Google Account → Personal info → Name)
- **When** the demo account signs out of Zeno and signs in again (the session takes the name at sign-in)
- **Then** Zeno's greeting uses "Maya"
- **Caller:** the opening (`firstName` from `session.user.name` in src/app/api/day/opening/route.ts)
- **Verified:** no

### AC2: A real Prof Patel email (DQ-2)

- **Given** one email sent to the demo account from a second address Vi owns, with the display name "Prof. Patel" and a
  subject about CS 146 office hours
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

- A name change in the demo Google account; one incoming email from an address Vi owns.

### Out of Scope

- Code changes. None.
- Sending any email from Zeno. Never.

## Technical Notes

- Order on Nov 3: do this before the release check (US0015) and before the reset (US0016), so shot 3's first sign-in
  already says Maya.

## Edge Cases & Error Handling

| Scenario | Expected Behaviour |
| --- | --- |
| The old session still says "De" | Sign out of Zeno and in again |
| The Patel email lands in Promotions or Updates | Move it to Primary; the inbox shows only people and school |
| Vi prefers not to rename the account | Keep "Hi De" and cut the greeting in the edit (DEMO-NOV4.md fallback) |
| No second address is available | The draft opens with an empty To; narration skips the address |
| The scan learns a fact from the Patel email | Fine: it is a real school contact for the demo |

## Test Scenarios

- [ ] After the rename and a new sign-in, the opening greets Maya.
- [ ] The draft request opens compose with the Patel address in To.

## Dependencies

### Story Dependencies

| Story | Type | What's Needed | Status |
| --- | --- | --- | --- |
| None | - | - | - |

### External Dependencies

| Dependency | Type | Status |
| --- | --- | --- |
| Vi's answers to DQ-2 and DQ-3 | Decision | Open |
| A second email address Vi owns | Account | Open |

## Estimation

**Points:** 1
**Complexity:** Low

## Rollback Envelope

**Affects production runtime:** false

*Not applicable: story does not change runtime behaviour.* To undo, rename the account back and delete the email.

## Open Questions

- [ ] DQ-2: send one email to the demo account from a second address Vi owns, signed Prof Patel? Default: yes. -
      Owner: Vi
- [ ] DQ-3: rename the demo Google account's first name to Maya? Default: yes. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the story from docs/DEMO-NOV4.md and HANDOFF section 0. Three Amigos lenses applied in-session by the author, not an independent review |
