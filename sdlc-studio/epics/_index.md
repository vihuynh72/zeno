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
| [EP0004](EP0004-demo-readiness-for-nov-4.md) | Demo readiness for Nov 4 | Draft | 8 | EP0001, EP0002 | 2026-11-03 | 2026-11-03 |
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

EP0001 (quiet focus) and EP0002 (voice) first, then EP0004 (demo readiness, which checks them on production). Each
must be on production before the Nov 3 reset (2 PM PT by default, DQ-1); anything later ships as a fix. That is 32
points on Nov 3 (US0017 runs on Nov 8 or 9), so here is a proposed cut order for Vi. EP0003 (the cheaper opening)
moved to Later: nothing about it shows on screen, and it rewrites the opening path the demo runs.

- **The video needs:** US0001, US0002, US0003 (brief §2: Muse picks each step's check-in minute "per task"; it is
  also the one new Muse decision shot 7 can claim, and use of Meta AI is 25% of judging), US0004, US0005, US0006,
  US0007, US0015, US0016. US0004's default minute is only the fallback when Muse leaves one out.
- **Cut first if Nov 3 runs short:** US0013 (the day-2 line; the narration can stay general), then US0012 (the
  sound), US0011 (tone), US0010 (reminders). US0014 is Vi's, in Google. If US0003 has to go anyway, PRD A4 must say
  the Nov 4 minute is a fixed default and shot 7 must drop "Muse picks each step's check-in moment" before recording.

### Later, in the recommended order

Only fixes reach `main` through the Nov 9 live final (the freeze, DQ-4): judges use the live app from Nov 4 to 8, and
the demo score counts live robustness. Until then each Later epic is built on its own branch with a Vercel preview
deploy, and merged after the final.

| Order | Epic | Why here |
| --- | --- | --- |
| 1 | EP0003 A cheaper opening when nothing changed | Small, and its stories are already written, so it merges first when the freeze ends; moved out of Nov 4 after review |
| 2 | EP0005 Installable app and the one daily nudge | Small; the brief says "PWA now" (whether sooner: OQ-20); it settles how the daily nudge and the Sunday check-up reach people, and adds the measures the outcomes need |
| 3 | EP0006 Goals, projects and steps, managed quietly | The answer to Vi's question about long-term goals; the model that Plan mode, re-planning, ranking and done detection all read. Its drafted week lives in Zeno until EP0010, never on a separate "Zeno" calendar |
| 4 | EP0010 Zeno on the main calendar | Moved up from 6: Vi said no to a separate "Zeno" calendar ("people don't want to think that much"), so it comes before Plan mode's drag to schedule and before the drafted week touches a calendar. Google's verification limits how many people can use it, not when it can be built |
| 5 | EP0007 Plan mode: the workspace | Vi's first big project after Nov 4; built once, on EP0006's model, with dragging onto the main calendar (OQ in EP0006: treat the two as one project) |
| 6 | EP0008 What matters first, and quiet re-planning | Makes the one card smarter every day; needs EP0006's kinds. Until then EP0006's simple turn rule decides whose turn it is |
| 7 | EP0009 Knowing work is done without asking | Closes the loop with no taps; needs EP0006's links from steps to their sources |
| 8 | EP0011 Canvas, all of it | Feeds grade weights into EP0008 and course files into EP0007 |
| 9 | EP0012 Capture from anywhere | Needs the installed app (share sheet) and projects to land in |
| 10 | EP0013 Tone setting and rewards | Small; the recap is best once EP0009 knows what got done; the default tone may already ship Nov 4 (US0011) |
| 11 | EP0014 More sources through MCP | Broad; every source must pass the privacy rules; after the model and the capture paths exist |
| 12 | EP0015 Native iPhone app | Needs an API-first server and a settled product; the lock-screen stopwatch reuses EP0001's |
| 13 | EP0016 Mac menu-bar companion | The same SwiftUI code as EP0015 |

### Not an epic yet (Vi's call)

- **Trying other realtime voice providers** (PRD J3). Meta's transcription stays for the hackathon.
- **Google's verification for the whole app**, before growth past 100 users. `gmail.readonly` is already a restricted
  scope, so Google's restricted-scope review with a security assessment is needed whether or not EP0010 ships; its
  broader calendar scope joins the same request. One request, planned as its own item (PRD §5, Scalability).
- **Measuring the outcomes** (PRD O1 to O4) is no longer here: it is one small story in EP0005 (the daily "opened"
  mark, an account key on each model-call log line, and the stress measure once Vi answers OQ-16).

## Notes

- Epics are numbered globally (EP0001, EP0002, etc.)
- Stories are tracked in [Story Registry](../stories/_index.md)
