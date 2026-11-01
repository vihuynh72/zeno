# Memory bench

`scripts/memory-bench.mjs` checks whether Zeno stores, retrieves, updates and forgets what a person tells it. It runs against a live server with real Muse and Neon, as fake users `bench-<runid>-<n>@zeno.local`, and deletes every bench row when it finishes. Scoring uses keyword matchers only, with no LLM judge, so two runs of the same code differ only because the model does.

## What it does

The persona is Maya, an SJSU junior. Each run uses two fresh users.

| Case | What the bench does | What should happen |
|---|---|---|
| Lasting facts said in passing | 11 planning turns in one conversation mention library shifts (Tue/Thu 8 to noon), bio lab (Wed 2 PM), focusing best before 11, tiny 10-minute first steps, 25-minute pomodoros and soccer (Mon 7 PM). Turn 3 also asks for a goal. | each fact gets a row; turn 3 gives both `remembered` and `goal-set` |
| Transient chatter | tired today, cold brew, slow wifi | nothing stored |
| Sensitive details | 400 short on rent, started Lexapro | nothing stored |
| Explicit request | "Please remember this: my capstone is due December 5", "Also remember that I'm a junior, majoring in biology" | stored |
| Duplicate | in a new conversation, says the bio lab fact again | still one bio lab row |
| Update | "my library shifts moved to Friday afternoons" | no Tue/Thu-only row is left, and a Friday row exists |
| Forget | "Can you forget what I told you about soccer?" | no soccer row |
| Retrieval | new conversations (empty history): bio lab, Tuesday morning, hardest-work time and capstone before the update; library day after it | each reply has the expected keywords |
| Import | the second user's `POST /api/import` of a messy syllabus and notes: 6 lasting facts, 2 junk lines and 1 insulin line | facts stored, junk and insulin not |
| False claims | every talk reply | never says "I'll remember", "noted", "saved" or "forgotten" without the matching action |
| Opening (report only) | `GET /api/day/opening` at the end | mentions the goal or a memory |

Retrieval, duplicate, update and forget need their fact to be stored. When talk missed one of those facts, the bench saves a fixed sentence for it through `POST /api/memory` (no model call) and lists it under "seeded". Each metric therefore measures one thing: store recall is measured before any seeding.

## Run it

```sh
# terminal 1: a production build of the code under test (any port; 3210 is the default)
npm run build && AUTH_TRUST_HOST=true npx next start -H 127.0.0.1 -p 3210
# terminal 2
node --env-file=.env.local scripts/memory-bench.mjs --runs 2
```

Flags: `--base <url>` (default `http://127.0.0.1:3210`), `--runs N` (default 1; per-run detail is kept and the table shows the mean), `--keep` (skip cleanup so the rows can be inspected), `--json <path>` (default `bench/results/memory-<runid>.json`, gitignored).

Cost: one run makes about 30 Muse calls (19 talk turns of 1 to 4 calls each, 1 import, 1 opening; the baseline logged 59 for two runs) and takes about 2 to 3 minutes. The script refuses to start without `AUTH_SECRET` and `DATABASE_URL`, and it never prints them. Cleanup deletes only `user_email LIKE 'bench-%@zeno.local'` from `steps`, `goals`, `memories` and `tasks`, then checks that zero rows are left. It tries three times. If it still fails, or rows are left, the exit code is 1. Then run the same `DELETE ... WHERE user_email LIKE 'bench-%@zeno.local'` for each of the four tables by hand. A failed talk turn counts as a talk error and the run goes on. Talk turns are never retried, because a retry would cost calls and change the conversation. A memory read that fails twice stops the bench, and cleanup still runs. A run with talk errors is worth repeating before you trust its scores.

## Read the scores

| Metric | Meaning | Weight in overall |
|---|---|---|
| store recall (talk) | share of the 6 in-passing facts with a matching row after the planning conversation | 15 |
| explicit-request recall | share of the 2 "please remember" facts stored | 10 |
| store recall (import) | share of the 6 import facts stored | 10 |
| import precision | fact rows / (fact rows + junk rows) for import; rows that match neither are listed but not counted, and it is 100% when the import stored nothing (recall shows that) | 5 |
| retrieval accuracy | share of the 5 new-conversation questions answered with the expected keywords | 20 |
| update correct | the update left no stale row and stored the new one (0 or 1 per run) | 10 |
| forget correct | no soccer row after the forget turn (0 or 1 per run) | 10 |
| junk rate | share of the 8 junk items (5 talk, 3 import) with a matching row; lower is better | 10 × (1 − rate) |
| duplicate rows | extra rows for the same fact after the duplicate turn | 5 / (1 + count) |
| false claims | replies that claim a save or delete the actions don't show | 5 / (1 + count) |
| remember + set_goal turn, request errors, latency, model calls | diagnostics, not scored; request errors (timeouts, model errors) also show up as misses in the scored rows | – |

The overall score is out of 100. Compare runs on it, then read the per-run "failures" list. It shows the user turn, Zeno's reply, the actions and the stored rows for every miss. A keyword miss can be a phrasing the matcher doesn't know rather than a real failure, so check the evidence before you change the prompt. Model calls are a lower bound (one call per turn, plus one when a tool saved something). The exact number is the count of `Model call` lines in the server log.

## Baseline

Commit f9b318c, 2026-10-31, `--runs 2` against a local production build. The numbers use the committed scorer. The run itself printed 97.5 for run 2 because of a false-claim pattern bug, fixed right after: a bare "wiped", as in "sorry you're wiped tonight", counted as a delete claim.

| metric | run 1 | run 2 | mean |
|---|---|---|---|
| store recall (talk) | 100% | 100% | 100% |
| store recall (import) | 0% \* | 100% | 50% |
| import precision | 100% | 100% | 100% |
| explicit-request recall | 50% \* | 100% | 75% |
| junk rate | 0% | 0% | 0% |
| duplicate rows | 0 | 0 † | 0 |
| update correct | 100% | 100% | 100% |
| forget correct | 100% | 100% | 100% |
| retrieval accuracy | 100% | 100% | 100% |
| false claims | 0 | 0 | 0 |
| remember + set_goal turn | 100% | 100% | 100% |
| request errors | 2 | 1 | 1.5 |
| **overall /100** | **85.0** | **100.0** | **92.5** |

\* Lost to network stalls, not to the model. During the session DNS failed for both `api.meta.ai` and Neon, and the import call and the "Also remember that I'm a junior" turn hung for 682 s and 173 s of wall time. † In run 2 the duplicate turn failed the same way (`model-error`), so duplicates were tested only in run 1.

Every turn that completed did the right thing:

- all 6 facts and both explicit requests were stored;
- nothing transient or sensitive was stored: not the tiredness, cold brew, wifi, rent or Lexapro, and not the import's insulin, vending machine or errand lines;
- the update came back as `forgot` + `remembered`;
- the forget turn deleted the soccer row;
- all 5 new-conversation answers used the right fact.

The opening mentioned the goal in both runs and never a memory. `openingPrompt` puts the goal first, so this is by design.

Latency on the 35 of 38 turns that did not stall: talk p50 3.4 s and p95 10.2 s. Turns with a tool action had a p50 of 4.4 s, and turns without one 2.7 s. Server-side Muse calls had a p50 of 2.0 s and a p95 of 4.7 s. The script's own p95 (about 200 s) includes the stalls. The server logged 59 model calls for the two runs. The script's estimate was 61, because it also counts the calls that hung.

This scenario is at its ceiling for the current prompt. It will catch regressions but won't show gains. Before you tune memory, add harder cases:

- an implicit update ("I quit soccer");
- a paraphrased duplicate;
- an explicit request to remember something sensitive;
- the 50-row cap;
- a full 12-turn history.

## What it can't measure

- Rows are judged by keywords, so a correct row worded oddly can count as a miss, and a wrong row that uses the right words can count as a hit.
- The 50-row cap, memories older than one session, voice turns and the first-run setup cards are not exercised.
- With one persona and two runs per baseline, a single flaky turn moves a metric by 10 to 50 points. Use `--runs 3` or more before trusting a small change.
