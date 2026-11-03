# EP0014: More sources through MCP

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** XL
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #11 of 13
> **Target Release:** After the Nov 9 live final (only fixes reach `main` before then)
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** H7, H8

## Summary

More places Zeno reads work from: Outlook and Microsoft 365, Notion and Todoist, GitHub, Linear and Jira, Slack, and
Google Docs (read only, for knowing when work is done).
Zeno becomes an MCP client, so "any MCP integration" can plug in without Zeno building each one by hand. Every source
follows the same privacy rules as Gmail and Canvas.

**Goal:** Zeno sees work wherever it lives, so the one card is right for people whose work is spread across tools.

## Business Context

### Problem Statement

Zeno reads Google Calendar, Gmail and Canvas. Daniel's work is spread across six tools; most of what he owes never
reaches Zeno. ([PRD section H](../prd.md#h-capture-sources-and-integrations))

**What the brief says (§7):** next sources: Outlook / Microsoft 365, Notion / Todoist, GitHub / Linear / Jira, Slack;
"any MCP integration": Zeno as an MCP client so integrations plug in.

### Value Proposition

- **With it:** Daniel's card reflects his reviews, tickets and threads.
- **Without it:** Zeno fits students well and professionals partly.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Sources Zeno reads | 3 | 3 plus any MCP server | Feature check |

## Scope

### In Scope

- Zeno as an MCP client: connect a server, read its tools' results as data.
- First sources, in an order set with Vi: Outlook / Microsoft 365, Notion / Todoist, GitHub / Linear / Jira, Slack.
- Google Docs, read only, so EP0009 can mark work done from a document's progress (the brief §3: "later Docs/GitHub
  progress → marked done"). Through a read-only Google Docs permission (another Google scope, so it joins the app's
  one verification request) or a Google Drive MCP server; the RFC picks one with Vi.
- Every source's data treated like calendar and email text: data, never instructions.
- The privacy rules on every source: private facts on the device only, the never-keep list, nothing personal to
  `*-contributor` models.

### Out of Scope

- Writing to these tools on the person's behalf. Asking first is the rule for anything other people see (L3); writes
  are a later decision.
- Marking work done from GitHub and Docs progress: EP0009 owns it (its last story), on the sources this epic adds.

### Affected Personas

- **Daniel Okafor:** "a product manager whose work is spread across six tools".

## Acceptance Criteria (Epic Level)

- [ ] A person can connect an MCP server and Zeno uses what it returns when picking and planning.
- [ ] Text from any source can never instruct Zeno (the same guard as calendar and email).
- [ ] No private fact from any source reaches Zeno's database or logs.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0012 | Shares capture paths and privacy rules | Draft |
| OAuth apps and verification per provider (Microsoft, Slack, …) | Each source needs its own consent | Not started |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0009 | Epic | Its last story marks work done from GitHub and Google Docs progress, read through this epic |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Prompt injection through tool output | High | High | Data-only framing, validation at the boundary, no write tools at first |
| Too many sources, too little focus | Medium | Medium | One source at a time, in Vi's order |

## Technical Considerations

### Architecture Impact

- An MCP client on the server, with per-account connections and tokens kept like Google's.

## Sizing

**Size:** XL

**Estimated Story Count:** 10 or more

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] Which source first? Default: Outlook / Microsoft 365, for people outside Google. - Owner: Vi
- [ ] Where MCP tokens live: on the server (like Google's) or the device (like Canvas)? Default: decided per source in
      an RFC. - Owner: Vi
- [ ] Google Docs through a Google permission or an MCP server? Default: decided in the RFC; a Google permission joins
      the app's one verification request. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
| 2026-11-03 | Claude | Review fixes: Google Docs added as a read-only source; marking work done from Docs and GitHub belongs to EP0009; #11 of 13 |
