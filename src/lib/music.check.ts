// Self-check for the focus music lists, play order and brown noise: node src/lib/music.check.ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});

const { TRACKS, brownNoise, playOrder } = await import("@/lib/music");

// Vi asked for at least 25 tracks, so nobody hears the same few every time.
assert.ok(TRACKS.lofi.length + TRACKS.piano.length >= 25, "at least 25 tracks");
assert.equal(new Set([...TRACKS.lofi, ...TRACKS.piano]).size, TRACKS.lofi.length + TRACKS.piano.length, "no track listed twice");
for (const src of [...TRACKS.lofi, ...TRACKS.piano].filter((src) => src.startsWith("/"))) {
  assert.ok(existsSync(new URL(`../../public${src}`, import.meta.url)), `${src} ships in public/`);
}
assert.ok(TRACKS.piano.filter((src) => src.startsWith("https://archive.org/download/")).length === 32, "the 32 Goldberg pieces stream");

// A seeded random, so the asserts hold on every run.
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

for (let run = 0; run < 200; run++) {
  const order = playOrder(TRACKS.lofi, TRACKS.lofi[run % TRACKS.lofi.length], random);
  assert.deepEqual([...order].sort(), [...TRACKS.lofi].sort(), "every track once");
  assert.notEqual(order[0], TRACKS.lofi[run % TRACKS.lofi.length], "never the one that just played");
}
assert.deepEqual(playOrder(["a"], "a", random), ["a"], "one track still plays");
assert.deepEqual(playOrder([], null, random), [], "no tracks, no order");

// Brown noise stays in range and loops as smoothly as it moves anywhere else.
const length = 48_000;
const noise = brownNoise(length, 4_800, random);
assert.equal(noise.length, length);
assert.ok(noise.every((sample) => Math.abs(sample) <= 1), "within -1..1");
let biggest = 0;
for (let i = 1; i < length; i++) biggest = Math.max(biggest, Math.abs(noise[i] - noise[i - 1]));
assert.ok(Math.abs(noise[0] - noise[length - 1]) <= biggest * 1.5, "no click where the loop starts over");
assert.ok(Math.sqrt(noise.reduce((sum, sample) => sum + sample * sample, 0) / length) > 0.02, "loud enough to hear");

console.log("music.check: all asserts passed");
