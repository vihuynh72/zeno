# Epic Registry

**Last Updated:** 2026-11-03
**PRD Reference:** [Product Requirements Document](../prd.md)

## Summary

| Status | Count |
| --- | --- |
| Draft | 16 |
| Ready | 0 |
| Approved | 0 |
| In Progress | 0 |
| Done | 0 |
| **Total** | **16** |

## Epics

| ID | Title | Status | Stories | Deps | Created | Updated |
| --- | --- | --- | --- | --- | --- | --- |
| [EP0001](EP0001-quiet-focus-stopwatch-one-check-in-and-back.md) | Quiet focus: stopwatch, one check-in and Back | Draft | 5 | None | 2026-11-03 | 2026-11-03 |
| [EP0002](EP0002-voice-that-waits-while-you-think.md) | Voice that waits while you think | Draft | 2 | None | 2026-11-03 | 2026-11-03 |
| [EP0003](EP0003-a-cheaper-opening-when-nothing-changed.md) | A cheaper opening when nothing changed | Draft | 2 | None | 2026-11-03 | 2026-11-03 |
| [EP0004](EP0004-demo-readiness-for-nov-4.md) | Demo readiness for Nov 4 | Draft | 7 | EP0001, EP0002 | 2026-11-03 | 2026-11-03 |
| [EP0005](EP0005-installable-app-and-the-one-daily-nudge.md) | Installable app and the one daily nudge | Draft | 0 | None | 2026-11-03 | 2026-11-03 |
| [EP0006](EP0006-goals-projects-and-steps-managed-quietly.md) | Goals, projects and steps, managed quietly | Draft | 0 | None | 2026-11-03 | 2026-11-03 |
| [EP0007](EP0007-plan-mode-the-workspace.md) | Plan mode: the workspace | Draft | 0 | EP0006 | 2026-11-03 | 2026-11-03 |
| [EP0008](EP0008-what-matters-first-and-quiet-re-planning.md) | What matters first, and quiet re-planning | Draft | 0 | EP0006 | 2026-11-03 | 2026-11-03 |
| [EP0009](EP0009-knowing-work-is-done-without-asking.md) | Knowing work is done without asking | Draft | 0 | EP0006 | 2026-11-03 | 2026-11-03 |
| [EP0010](EP0010-zeno-on-the-main-calendar.md) | Zeno on the main calendar | Draft | 0 | None | 2026-11-03 | 2026-11-03 |
| [EP0011](EP0011-canvas-all-of-it.md) | Canvas, all of it | Draft | 0 | None | 2026-11-03 | 2026-11-03 |
| [EP0012](EP0012-capture-from-anywhere.md) | Capture from anywhere | Draft | 0 | EP0005, EP0006 | 2026-11-03 | 2026-11-03 |
| [EP0013](EP0013-tone-setting-and-rewards.md) | Tone setting and rewards | Draft | 0 | EP0009 | 2026-11-03 | 2026-11-03 |
| [EP0014](EP0014-more-sources-through-mcp.md) | More sources through MCP | Draft | 0 | EP0006 | 2026-11-03 | 2026-11-03 |
| [EP0015](EP0015-native-iphone-app.md) | Native iPhone app | Draft | 0 | EP0005 | 2026-11-03 | 2026-11-03 |
| [EP0016](EP0016-mac-menu-bar-companion.md) | Mac menu-bar companion | Draft | 0 | EP0015 | 2026-11-03 | 2026-11-03 |

## Order and why

Draft, awaiting Vi's approval. Vi approves each epic (brief §9); Claude then writes its stories and runs the sprints.

### Nov 4: only what the demo needs

EP0001 (quiet focus) and EP0002 (voice) first, then EP0004 (demo readiness, which checks them on production). EP0003
(the cheaper opening) ships only if it is on production by Nov 3 evening; it changes nothing on screen. That is 37
points in one day, so here is a proposed cut order for Vi.

- **The video needs:** US0001, US0002, US0004 (works with its default minute alone), US0005, US0006, US0007, US0015,
  US0016.
- **Cut first if Nov 3 runs short:** EP0003 (US0008, US0009), then US0013 (the day-2 line; the narration can stay
  general), US0012 (the sound), US0003 (Muse's minute; the default minute still gives one quiet line), US0011 (tone),
  US0010 (reminders). US0014 is Vi's, in Google.

### Later, in the recommended order

| Order | Epic | Why here |
| --- | --- | --- |
| 1 | EP0005 Installable app and the one daily nudge | Small; the brief says "PWA now"; it settles how the one daily nudge and the Sunday check-up reach people before EP0006 builds them |
| 2 | EP0006 Goals, projects and steps, managed quietly | The answer to Vi's question about long-term goals; the model that Plan mode, re-planning, ranking and done detection all read |
| 3 | EP0007 Plan mode: the workspace | Vi's first big project after Nov 4; built once, on EP0006's model (OQ in EP0006: treat the two as one project) |
| 4 | EP0008 What matters first, and quiet re-planning | Makes the one card smarter every day; needs EP0006's kinds |
| 5 | EP0009 Knowing work is done without asking | Closes the loop with no taps; needs EP0006's links from steps to their sources |
| 6 | EP0010 Zeno on the main calendar | Needs Google's verification for a broader scope, which takes weeks: start the request when Vi approves, build while it is pending |
| 7 | EP0011 Canvas, all of it | Feeds grade weights into EP0008 and course files into EP0007 |
| 8 | EP0012 Capture from anywhere | Needs the installed app (share sheet) and projects to land in |
| 9 | EP0013 Tone setting and rewards | Small; the recap is best once EP0009 knows what got done; the default tone may already ship Nov 4 (US0011) |
| 10 | EP0014 More sources through MCP | Broad; every source must pass the privacy rules; after the model and the capture paths exist |
| 11 | EP0015 Native iPhone app | Needs an API-first server and a settled product; the lock-screen stopwatch reuses EP0001's |
| 12 | EP0016 Mac menu-bar companion | The same SwiftUI code as EP0015 |

### Not an epic yet (Vi's call)

- **Trying other realtime voice providers** (PRD J3). Meta's transcription stays for the hackathon.
- **Measuring the outcomes** (PRD O1 to O4): a once-a-day "opened" mark per account, the AI cost per person, and how to
  measure stress without asking to learn (OQ-15, OQ-16). EP0005 lists the "opened" mark as its metric's source.

## Notes

- Epics are numbered globally (EP0001, EP0002, etc.)
- Stories are tracked in [Story Registry](../stories/_index.md)
