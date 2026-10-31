// Self-check for sourcesFrom in prep.ts (no network): node src/lib/prep.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// prep.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { sourcesFrom } = await import("./prep.ts");

const good = {
  title: "Sourdough Starter Recipe | King Arthur Baking",
  url: "https://www.kingarthurbaking.com/recipes/sourdough-starter-recipe",
  why: "Day-by-day feeding schedule with exact gram measurements",
};
const reply = (...sources: unknown[]) => JSON.stringify({ sources });

assert.deepEqual(sourcesFrom(reply(good)), [good], "a good source passes unchanged");
assert.deepEqual(sourcesFrom(reply(good, good, good, good)).length, 3, "at most 3");
assert.deepEqual(sourcesFrom(reply()), [], "none found");
assert.deepEqual(sourcesFrom("{}"), [], "no list");
assert.deepEqual(sourcesFrom("null"), [], "null");
assert.throws(() => sourcesFrom("I'll search the web for good guides."), /not JSON/, "a preamble is not an answer");

for (const url of [
  "http://example.com/page",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "https://user:pass@example.com/",
  "https://localhost/admin",
  "example.com/no-scheme",
  `https://example.com/${"a".repeat(500)}`,
  42,
  null,
]) {
  assert.deepEqual(sourcesFrom(reply({ ...good, url })), [], `rejects ${String(url).slice(0, 40)}`);
}

const [cut] = sourcesFrom(
  reply({ title: "  A\n title  ", url: "https://example.com/a b", why: "one two three four five six seven eight nine ten eleven twelve thirteen" }),
);
assert.deepEqual(
  cut,
  { title: "A title", url: "https://example.com/a%20b", why: "one two three four five six seven eight nine ten eleven twelve" },
  "whitespace folded, url normalized, why cut to 12 words",
);
assert.deepEqual(sourcesFrom(reply({ ...good, title: "" }, { ...good, why: "   " }, null, "text", { url: good.url })), [], "missing fields drop");

console.log("prep self-check passed");
