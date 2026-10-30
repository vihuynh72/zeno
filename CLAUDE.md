# Zeno: notes for coding agents

Start with HANDOFF.md (current state, in-flight branches, next steps), then the Linear doc "Zeno hackathon build plan (Nov 4)".

- Production https://zeno-sigma-topaz.vercel.app deploys from `main`. Vi lets Claude merge to `main` after all checks pass and lets Claude edit anything in the Linear Zeno project. Ask Vi before big product choices.
- Checks: `npx next typegen` (fresh checkout), `npx tsc --noEmit --incremental false`, `npx eslint src/`, `npx next build`, and every `*.check.ts` / `scripts/*-check.mjs`.
- Next 16 + `cacheComponents`: no `runtime`/`dynamic`/`revalidate`/`fetchCache`/`dynamicParams` exports in route files.
- Dates and times: the server runs in UTC; use `src/lib/tz.ts`.
- Muse: always set `reasoning_effort`; never send personal data to `*-contributor` models; never speak a tool-call preamble as a result.
- Voice locally needs `npx vercel@65.7.0 dev --local`.
- Secrets stay in `.env.local` / Vercel. Never print or commit them.
- Design: keep it as simple as possible (Vi: "not overwhelming"); the Index Card direction contract lives in `.impeccable/surfaces/src-app-page-tsx.md` (local).
