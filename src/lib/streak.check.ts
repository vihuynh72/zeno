// Self-check for streakFrom in goals.ts (no database needed): node src/lib/streak.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// goals.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { streakFrom } = await import("./goals.ts");

const today = "2026-10-31";
assert.equal(streakFrom([], today), 0, "none");
assert.equal(streakFrom(["2026-10-31"], today), 1, "only today");
assert.equal(streakFrom(["2026-10-29", "2026-10-31", "2026-10-30"], today), 3, "today, yesterday and the day before, in any order");
assert.equal(streakFrom(["2026-10-31", "2026-10-30", "2026-10-28", "2026-10-27"], today), 2, "a gap ends the run");
assert.equal(streakFrom(["2026-10-30", "2026-10-29"], today), 2, "nothing yet today: the run ends yesterday");
assert.equal(streakFrom(["2026-10-29", "2026-10-28"], today), 0, "a missed yesterday ends it");
// US clocks fall back on Nov 1 (a 25-hour day) and spring forward on Mar 8 (23 hours).
assert.equal(streakFrom(["2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-02"), 3, "DST ends");
assert.equal(streakFrom(["2026-03-07", "2026-03-08"], "2026-03-09"), 2, "DST starts, ending yesterday");
assert.equal(streakFrom(["2025-12-31", "2026-01-01"], "2026-01-01"), 2, "across the new year");

console.log("streak self-check passed");
