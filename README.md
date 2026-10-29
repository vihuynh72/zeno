# Zeno

Zeno is a personal daily chief of staff on the web. Sign in with Google, see
today on your calendar, keep saved goals for the day, read recent email, get a
short AI brief, and talk with Zeno by text or voice.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env.local` and fill in the values there. Never commit
`.env.local`.

## Checks

```bash
npm run build
npx tsc --noEmit
npx eslint src/
```

## Deploy

The app deploys on Vercel from this repository. Set the same environment
variables from `.env.example` in the Vercel project before deploying.
