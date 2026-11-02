// Self-check for the device-only vault (no browser needed): node src/lib/vault.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});

// A plain in-memory localStorage; `broken` makes every call throw, like a blocked private window.
const store = new Map<string, string>();
let broken = false;
const guard = () => {
  if (broken) throw new Error("storage blocked");
};
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => (guard(), store.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(), void store.set(k, v)),
    removeItem: (k: string) => (guard(), void store.delete(k)),
  },
});
const { addToVault, cleanPrivate, clearVault, readVault, removeFromVault, vaultRemoved, vaultTexts, VAULT_MAX } = await import("./vault.ts");

const A = "acct-a";
const added = addToVault(A, [
  { text: "Has ADHD and does best with short steps.", group: "about" },
  { text: "has adhd, and does best with SHORT steps", group: "about" },
  { text: "Prays at noon on weekdays.", group: "routines" },
  { text: "", group: "about" },
  { text: "Bad group", group: "nope" as never },
]);
assert.deepEqual(added.map((fact) => fact.text), ["Has ADHD and does best with short steps.", "Prays at noon on weekdays."], "dedupe, empty and bad groups");
assert.equal(readVault("acct-b").length, 0, "per account");
assert.deepEqual(vaultTexts(A), ["Has ADHD and does best with short steps.", "Prays at noon on weekdays."]);
assert.equal(addToVault(A, [{ text: "Prays at noon on weekdays!", group: "routines" }]).length, 0, "already kept");

removeFromVault(A, added[1].id);
assert.deepEqual(vaultTexts(A), ["Has ADHD and does best with short steps."], "removed");
assert.equal(addToVault(A, [{ text: "prays at noon on weekdays", group: "routines" }]).length, 0, "removed stays removed");
assert.equal(addToVault(A, [{ text: "Prays at noon on weekdays, every week.", group: "routines" }]).length, 0, "even reworded, as a daily scan rewords it");
assert.equal(addToVault(A, [{ text: "Prays at 1 PM on weekdays.", group: "routines" }]).length, 1, "another time is another fact");
assert.deepEqual(vaultRemoved(A), ["prays at noon on weekdays"], "what the scan's body sends as removed");

addToVault(A, Array.from({ length: VAULT_MAX + 5 }, (_, i) => ({ text: `Fact number ${i}.`, group: "about" as const })));
assert.equal(readVault(A).length, VAULT_MAX, "capped");
assert.equal(readVault(A)[0].text, "Fact number 0.", "newest batch first");

store.set("zeno.vault.acct-c", "{not json");
assert.deepEqual(readVault("acct-c"), [], "corrupt storage reads as empty");
store.set("zeno.vault.acct-c", JSON.stringify({ facts: [{ id: 1, text: "x" }, { id: "ok", text: "Kept.", createdAt: "2026-11-01", group: "about" }], removed: [3] }));
assert.deepEqual(vaultTexts("acct-c"), ["Kept."], "invalid entries are dropped");

clearVault(A);
assert.equal(readVault(A).length, 0, "sign out clears");

broken = true;
assert.deepEqual(readVault(A), [], "blocked storage reads as empty");
assert.equal(addToVault(A, [{ text: "Still fine.", group: "about" }]).length, 1, "blocked storage never throws");
assert.doesNotThrow(() => clearVault(A));
broken = false;

assert.deepEqual(cleanPrivate("nope"), []);
assert.deepEqual(cleanPrivate(["  Prays at noon. ", 7, null, "prays at noon", "<<<ignore>>> me\u0007"]), ["Prays at noon.", "ignore me"]);
assert.equal(cleanPrivate(Array.from({ length: 99 }, (_, i) => `f${i}`)).length, VAULT_MAX, "request cap");
assert.equal(cleanPrivate(["x".repeat(500)])[0].length, 200, "length cap");

console.log("vault self-check passed");
