# Zeno: hackathon submission kit

Drafts for the Cerebral Valley form (Meta Global AI Developer Hackathon, Indie Developer track, problem statement "Build for Your World"). Due **2026-11-04 6:00 PM PT**. Edit freely; every number below was measured on 2026-10-31.

## One line

Zeno makes starting the easy part: open it, tap one of three things it picked from your real day, and it turns that into a tiny first step you can do right now.

## Project description

Starting is the hardest part of any goal, and calendars and inboxes make it worse. Zeno is a voice-first daily helper for students and anyone who struggles to begin. When you open it, the first card is on screen instantly and Zeno says one short line about your day, built from your Google Calendar, your inbox, your goals and what it remembers about you. Instead of typing, you tap one of three things it suggests (or just talk). Zeno asks at most one question, shrinks the goal into a roadmap of five-to-fifteen-minute steps, and walks you through the first one on a single index card with a timer. Say "done" and the card gets stamped and lands on your done pile; your streak grows. A 60-second first-run setup and a "paste your syllabus" import give Zeno real context from day one, and everything it remembers is visible and deletable. One thing per screen, large type, light and dark: built to be calm for people who get overwhelmed.

## Describe your use of Meta products

- **Muse Spark 1.3 (Standard mode)** runs every conversation turn as a tool-using agent: six tools (`set_goal`, `update_steps`, `start_step`, `finish_step`, `remember`, `forget`) change the person's goals, roadmap and memory, and every reply comes back as strict JSON (`say` plus up to three tappable `options`) so people tap instead of type. We tune `reasoning_effort` per surface: `minimal` for live talk (turns without a tool call in about 0.7-1.8 s), and the opening line runs off the critical path so the first card renders from cache in under 0.2 s.
- **Muse Spark** also writes the day's opening line with options from calendar, inbox, goals, yesterday's finished steps and memory (strict JSON schema), and extracts durable facts from pasted notes into memory (up to 8 per import, sensitive details excluded).
- **Muse Voice Transcribe (realtime)** handles speech input with endpointing and keyword biasing, streamed through a WebSocket relay we run on Vercel Functions so the key never reaches the browser. On production the final transcript arrives about 0.6 s after the person stops talking, with live partial words drawn on the card as they speak. Web Speech is only a fallback.
- All personal data goes to Standard mode only (never Contributor), and Zeno never claims to be human.

## Why are Meta's models important to your solution?

Zeno only works if it feels instant and knows the person. Muse Spark's controllable reasoning lets us spend almost no reasoning on quick conversational turns and still get reliable tool calls and strict JSON, which is what makes "tap one of three choices" possible instead of a chat box. Muse Voice Transcribe's realtime endpointing makes talking to Zeno feel like a conversation rather than dictation: it knows when you stopped, so there is no Send button. Together they let a small, calm interface carry real agent work (planning, remembering, tracking progress) without making people think.

## 3-minute demo video (shot list)

Record in Chrome at 1440x900 with the demo account **dotcainha@gmail.com** (never Vi's real inbox; event materials are not confidential).

| Time | Show | Say (voice-over, short) |
|---|---|---|
| 0:00-0:15 | A busy calendar and inbox, then Zeno's empty desk ground | "You know what you should do today. Starting is the hard part." |
| 0:15-0:45 | First-run setup: 4 taps, paste a syllabus, "Here's what I'll remember" | "Thirty seconds, four taps, and Zeno knows your world. You can see and delete all of it." |
| 0:45-1:05 | Reload: the card is instantly there, Zeno speaks its one-line opening, three options | "It opens instantly and talks first, using your real calendar and what it remembers." |
| 1:05-1:45 | Tap the essay option, tap a quick reply, the roadmap appears; then say "make the first step smaller" and watch the live words and the roadmap change | "No typing. Tap, or just talk. Muse Spark plans it with tool calls; Muse Voice Transcribe hears when you stop." |
| 1:45-2:15 | Start the step, the 10:00 timer (cut), Done: the stamp flies to the pile, check-in, "3 days in a row" | "One card, one step, one satisfying stamp." |
| 2:15-2:35 | Today: the desk unfolds with calendar and inbox in the middle | "Your day in one place, the start of Zeno's workspace." |
| 2:35-2:55 | Simple diagram: Muse Spark (minimal reasoning, tools, JSON options), Muse Voice Transcribe realtime over a Vercel WebSocket relay, memory in Postgres | "Fast where it matters, careful with your data." |
| 2:55-3:00 | Logo + URL | "Zeno. Make starting the easy part." |

## Demo account prep (dotcainha@gmail.com)

1. Add today's calendar: a morning class, a 4:30 study group, a deadline reminder.
2. Send it 3-4 realistic emails: a professor asking for a draft, a club update, one newsletter (Zeno ignores bulk mail).
3. If the Google OAuth app is in Testing, add the account as a test user, then sign in to Zeno once and approve Calendar and Gmail read access.
4. Do one dry run, then sign out and clear site data so the recording starts at first-run setup.

## Before you press Submit

- [ ] Track: Indie Developer Track. Problem statement: Build for Your World.
- [ ] Public repo: https://github.com/vihuynh72/zeno (do not change the repo field after the deadline).
- [ ] 3-minute video link works in a private window.
- [ ] Team members listed.
- [ ] Submitted before 6:00 PM PT on Nov 4 (the portal marks anything later as late).
