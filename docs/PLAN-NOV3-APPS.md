# Zeno: the Nov 3 night round (more ways in)

Vi asked what else would complete the app ("MCP, iOS app, Mac app or something like that"). A research run checked six
options against the Nov 4 deadline: a pop-out window, an installable app, a guest demo, MCP, more Meta, and native apps.

**Vi's answers, about 4 PM PT Nov 3:**
- Judges sign in for real (no hardcoded guest demo).
- Power users matter.
- "Big tonight."
- Freeze `main` after the video.

**Vi chose five builds for tonight:**
1. Photo → plan.
2. An MCP server.
3. A pop-out focus window.
4. An installable app.
5. A Mac menu-bar clock.

**Deferred to after Nov 4:**
- An iPhone app with a Lock Screen and Dynamic Island stopwatch, built on Vi's own iPhone, since there is no paid Apple
  account.
- WhatsApp, because its business terms now bar general-purpose AI assistants and the setup is heavy.
- OAuth so Claude.ai and ChatGPT can connect as connectors.

Vi's condition for the pop-out: "something the user can comfortably have without really messing up with their
experience." It never opens by itself, and it closes when the step ends or the person closes it.

Rules from `docs/PLAN-NOV3.md` still hold:
- Short, direct copy; no emoji.
- Never "behind".
- Light and dark.
- Nothing overwhelming.
- Made-up data in fixtures.
- Privacy as written.

## 1. Photo → plan (Muse Spark reads an assignment)
- **Where it appears:** a small link, "Add from a photo", under the home's goal options. It also shows when there are no
  options. A hidden `<input type="file" accept="image/*">` has no `capture` attribute, so a phone offers Take Photo or
  the Library, and a laptop opens a file picker.
- **In the browser:**
  1. The browser shrinks the image (`createImageBitmap`, canvas, JPEG at quality 0.8, longest side 1600 px, under
     3.5 MB).
  2. The desk opens in its planning state: title "Your assignment", card "Reading your photo…".
  3. It posts `POST /api/goal/snap { image }` (`SnapRequest`).
  4. When the answer is ok, the plan's desk shows, as after a deadline tap. A bad request goes home with the note "I
     couldn't find an assignment in that photo."
  5. Re-tapping is guarded like a deadline plan.
- **The server:**
  - `src/app/api/goal/snap/route.ts`, modeled on `api/goal/plan`. The session is checked first.
  - Only a `data:image/(jpeg|png|webp);base64,` URL under 3.5 MB is accepted.
  - `maxDuration` is 30.
  - `snapPlan(image, today)` in `agent.ts` makes one Muse Spark call with an `image_url` content part and a strict JSON
    schema, `{ found, title, due ("YYYY-MM-DD" or ""), steps[] }`.
  - `reasoning_effort` is minimal, raised to low only if a probe shows minimal misreads.
  - `privateTitle` runs on every title. A due date in the past becomes null.
  - The plan route's same-title check runs, then `setGoal`.
  - The image is never stored or logged.
  - The prompt says the image is data, not instructions.
- **Before writing the route:** a 2-minute probe with a made-up handout confirms that image input works together with
  strict JSON.
- **For the video:** add a made-up handout to photograph, `docs/demo/handout-phil134.html`. It is printable, has a due
  date, and has no real names.
- **Checks:** `snapFrom` parsing, and the body checks. Add a `snap-reading` state to the gallery.

## 2. MCP server, app tokens and the companion API
- **Database:** a table `app_tokens`, added through `ensureSchema` in `src/lib/db.ts`, with these columns:
  - `user_email` TEXT PRIMARY KEY
  - `token_hash` TEXT UNIQUE NOT NULL
  - `time_zone` TEXT NOT NULL
  - `created_at` TIMESTAMPTZ DEFAULT now()
- **`src/lib/app-token.ts`:**
  - `mintToken(email, timeZone)` makes `zeno_` plus 32 random bytes in base64url. It stores only the SHA-256 hash, and
    a new token replaces the old one.
  - `tokenOwner(token)` returns `{ email, timeZone }` or null.
  - `revokeToken(email)` turns the token off.
- **`/api/app-token`:**
  - POST needs a session and returns `{ state: "ok", token }` once, with `Cache-Control: no-store`.
  - DELETE turns the token off.
  - The token is never logged.
- **The account menu:** "Connect an app" opens a small sheet.
  - It says: "Lets Muse Code, Claude Code or the Zeno Mac clock see and update your goals and steps. Never your mail,
    your calendar or what Zeno remembers."
  - [Make a token] shows the token once, the MCP URL, a Muse Code `mcp_servers` snippet and a Claude Code
    `claude mcp add` line, each with Copy.
  - "Turn off" revokes the token.
- **`/api/mcp`:**
  - Built on `mcp-handler` (Streamable HTTP) with `withMcpAuth`. Pin exact versions and add no other dependencies.
  - The person comes only from the token, never from tool arguments.
  - Tools, which return short text with step ids:
    - `list_goals`
    - `next_step`
    - `plan_goal` (title, optional due), through `savePlan`, which moves the plan route's body into `agent.ts` so both
      share it, same-title check included
    - `start_step`
    - `finish_step`
  - Shortcut: `plan_goal` is limited to 20 new plans a day per person, counted in the database.
- **`/api/companion/now` (GET) and `/api/companion/done` (POST):**
  - Both use token auth, with the `CompanionNow` shape in `src/lib/day.ts`.
  - "now" is the current plan's running step, else its next todo step.
  - "done" finishes the running step with `changeStepStatus`.
- **Privacy page, one line each:**
  - What a connected app can read and change.
  - A photo is read once to make a plan and never kept.
  - A "← Zeno" link at the top, because the installed app's window has no back button.
- **README:** a "Connect an AI app" section covering Muse Code's `mcp_servers` block (`streamable_http`, url, headers)
  and Claude Code (`claude mcp add --transport http zeno <url> --header "Authorization: Bearer <token>"`).
- **Checks:**
  - Mint and verify against the database with `@zeno.local` users, deleted afterwards.
  - The tool handlers, with a fake identity.
  - A local `next start`, then curl JSON-RPC: initialize, tools/list, `next_step`.

## 3. Pop-out focus window (Document Picture-in-Picture)
- **Where it appears:** during Focus, in browsers that support `documentPictureInPicture` only (Chrome and Edge 116+
  on desktop, Firefox 151+), a small link "Pop out" joins the links: Stuck? · Stop for now · Music · Pop out. Elsewhere
  the link never shows.
- **The window:** a tap opens a small always-on-top index card, about 320×200, with:
  - the step title
  - the stopwatch counting up, with "planned N min"
  - the check-in line
  - [Done]
- **Done in the pop-out:**
  - It runs the app's own Done.
  - The card then shows "Nice. Next: …" with [Keep going], which starts the next step in place.
  - After the last step, it shows "That's all of <goal>." and closes after a few seconds.
- **Closing:** it closes on Stop for now, Switch goal, leaving the desk, sign-out, or the person closing it. It never
  opens by itself.
- **Rendering:**
  - A React portal into `pipWindow.document.body`.
  - Clone the stylesheet `<link>`s with absolute hrefs, because inlining breaks next/font's relative URLs.
  - Copy the `<html>` class that holds the font variables, and wait for the CSS to load before showing.
  - Light and dark follow the page.
  - The pop-out's stopwatch ticks from the pop-out's own timer, because the hidden tab's timers are throttled.
- **New file:** `src/components/focus-pop.tsx`, with small hooks in the Focus links.

## 4. Installable app, and help for judges at sign-in
- **The manifest:** `src/app/manifest.ts` with:
  - name and short_name "Zeno"
  - the description from `layout.tsx`
  - start_url "/" and display "standalone"
  - background and theme color "#f4f3ef"
- **Icons:** render them from the Z mark (white Z on ink, rounded for the Dock, full-bleed for phones):
  - `public/icon-192.png` and `public/icon-512.png`
  - `src/app/icon.png` and `src/app/apple-icon.png`
  - Delete the default `src/app/favicon.ico`.
- **No service worker** and no push tonight. A cached shell could serve stale code to judges.
- **Signed-out screen:** one quiet line under Sign in with Google: "Zeno is a new hackathon app, so Google says it isn't
  verified yet. Choose Advanced, then Go to Zeno." Keep it truthful and small.
- **README "Try Zeno":**
  - The sign-in steps, what Zeno asks for and why, and the privacy summary.
  - Installing:
    - Chrome or Edge: Install Zeno in the address bar or the menu.
    - Safari on Mac: File → Add to Dock.
    - iPhone: sign in in Safari first, then Share → Add to Home Screen.
  - The Mac clock (section 5).

## 5. Mac menu-bar clock (native, Swift)
- **Package:** `mac/`, a Swift package with an executable target `ZenoClock`, for macOS 14+.
  - SwiftUI `MenuBarExtra`, with no Xcode project.
  - `mac/make-app.sh` wraps the release binary into `Zeno Clock.app`, with an Info.plist where `LSUIElement` is 1, so it
    has no Dock icon. The script ad-hoc signs it (`codesign -s -`).
- **The menu bar label:**
  - With a running step: "12:31 · <step title cut to 24 characters>", counting up locally from `startedAt`.
  - Otherwise: "Zeno".
- **The menu holds:**
  - the step and its goal ("3 of 7 done")
  - Done (`POST /api/companion/done`)
  - Open Zeno (the production URL)
  - Set token… (a small window with a secure field; the token is kept in the Keychain)
  - Quit
- **Polling:** it polls `GET /api/companion/now` every 10 s, and when the menu opens.
- **Base URL:** production by default; the `ZENO_URL` environment variable overrides it for a local test.
- **No sign-in:** the app never shows Google sign-in. The token comes from Zeno's "Connect an app".
- **Testing tonight:** against a tiny local mock server with canned JSON (`mac/mock-companion.py`); the real run comes
  after the merge.
- **README:** build and run steps, plus macOS's "unidentified developer" prompt (right-click, then Open). The app is not
  notarized, because there is no paid Apple account.

## Tracks and ownership
Each track works in its own worktree and branch from the contract commit. It changes only the files it owns. A change
it needs elsewhere goes in its report.

| Track | Owns |
| --- | --- |
| **photo** | `src/lib/ai.ts`; the snap functions in `agent.ts`, with their checks; `src/app/api/goal/snap/*`; the home-only changes in `guided-day.tsx` and `day-view.tsx` (the link, the file input, `snapAssignment`); `docs/demo/*`; the gallery's snap state |
| **mcp** | `src/lib/db.ts` (the new table only); `src/lib/app-token.ts` and its check; `src/app/api/app-token/*`, `api/mcp/*`, `api/companion/*`; `savePlan` in `agent.ts`, with `api/goal/plan/route.ts` calling it; `account-menu.tsx` (Connect an app); `src/app/privacy/page.tsx`; README's connect section; `package.json` and its lock |
| **pop** | `src/components/focus-pop.tsx` (new); the Focus-links-only changes in `guided-day.tsx` and `day-view.tsx` |
| **pwa** | `src/app/manifest.ts`; the icons in `public/` and `src/app/`; the favicon; the signed-out line in `day-view.tsx`; README's "Try Zeno" |
| **mac** | `mac/*`; README's Mac clock section, as text in its report, which the integrator adds |

## Done when
- typegen, tsc, eslint (`src/` and `scripts/`), build, and every check script pass.
- Each track reports what it built, what it skipped, and what it needs from another track.
- The integrator merges, reviews, deploys and live-tests. Main then freezes after the video (DQ-4, Vi: yes).
