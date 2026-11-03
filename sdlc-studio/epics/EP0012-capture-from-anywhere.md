# EP0012: Capture from anywhere

> **Status:** Draft
> **Created:** 2026-11-03
> **Created-by:** sdlc-studio new
> **Raised-by:** Claude; agent; claude-opus-5-5
> **Size:** L
> **Approval:** Draft, awaiting Vi's approval
> **Priority:** Later, #8 of 12
> **Target Release:** After Nov 4
> **Owner:** Claude
> **Reviewer:** Vi
> **PRD:** H6

## Summary

Throw anything at Zeno and it lands in the right project: forward an email, share a link or a file from another app,
take a photo of a page, or paste a big master plan. Talking, typing and pasting notes already work; this epic adds the
rest.

**Goal:** capture costs nothing, so nothing lives only in someone's head.

## Business Context

### Problem Statement

Today Zeno takes talk, typing and pasted notes (Memory's Add box). Work that arrives as an email, a link, a PDF or a
photo has to be retyped. ([PRD section H](../prd.md#h-capture-sources-and-integrations))

**What the brief says (§7):** capture everything: talk and type, forward an email, share a link or file, a photo of a
page, a big master plan. And Vi: Zeno is not "an app to record stuff", so what comes in is there for Zeno to act on.

### Value Proposition

- **With it:** a syllabus photo becomes a term of projects; a forwarded email becomes a step.
- **Without it:** capture is work, so people skip it.

### Success Metrics

| Metric | Current | Target | Measurement |
| --- | --- | --- | --- |
| Ways to capture | 3 (talk, type, paste) | 7 | Feature check |
| Captures that land in a project with one tap | Not possible | Proposed with Vi | Captures confirmed against captures made |

## Scope

### In Scope

- Share into Zeno from other apps (links, files, text) through the installed app's share sheet.
- Forward an email to Zeno (how: OQ below).
- A photo of a page, read into steps or facts.
- A big master plan (a long paste or a file) turned into goals, projects and steps, with one tap to confirm.
- Dropping things onto a project in Plan mode (with EP0007).

### Out of Scope

- Keeping the files or emails themselves. Zeno keeps what it learned, never the raw text (PRD §7: "Never stored:
  … raw pasted notes, the emails themselves").
- A notes archive. Zeno is "not an app to record stuff".

### Affected Personas

- **Daniel Okafor:** the PRD's story for him: "throw anything at Zeno (an email, a link, a photo, a plan) and have it
  land in the right project".
- **Rosa Delgado:** a syllabus photo from her phone.
- **Maya Torres (Primary):** a handout photo after class.

## Acceptance Criteria (Epic Level)

- [ ] Sharing a link, file or text from another app opens Zeno with a proposal of where it goes; one tap confirms.
- [ ] A photo of a page becomes proposed steps or facts.
- [ ] A long master plan becomes proposed goals, projects and steps; one tap confirms.
- [ ] Private facts in anything captured follow the privacy rules: device only, never stored on the server.

## Dependencies

### Blocked By

| Dependency | Type | Status | Owner |
| --- | --- | --- | --- |
| EP0005 | Epic | Draft | Claude |
| EP0006 | Epic | Draft | Claude |

### External

| Dependency | Why | Status |
| --- | --- | --- |
| EP0007 | Drop onto a project | Draft |
| Muse reading images | A photo of a page needs a model that reads images | Unverified |

### Blocking

| Item | Type | Impact |
| --- | --- | --- |
| EP0014 | Epic | Shares the capture paths and their privacy rules |

## Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Muse cannot read images | Unknown | Medium | Check before stories; otherwise drop photos or use the browser's text recognition |
| Captured text carries instructions to Zeno | Medium | High | The same guard as calendar and email text: data, never instructions |

## Technical Considerations

### Architecture Impact

- The PWA's `share_target`; the import path in `src/app/api/import/route.ts` and `extractNotes` in `src/lib/agent.ts`.

## Sizing

**Size:** L

**Estimated Story Count:** 6

## Story Breakdown

_No stories yet._

Stories are written after Vi approves this epic.

## Open Questions

- [ ] How "forward an email" works with no inbound address and no sending service. Default: a Gmail label (for
      example "Zeno") that the daily scan reads. - Owner: Vi
- [ ] Does Zeno keep shared files, or only what it learned from them? Default: only what it learned. - Owner: Vi

## Revision History

| Date | Author | Change |
| --- | --- | --- |
| 2026-11-03 | Claude | Created via `new` (deterministic) |
| 2026-11-03 | Claude | Wrote the epic from the PRD and Vi's Nov 3 brief |
