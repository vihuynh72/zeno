// Self-check for the device-only Canvas link (no browser needed): node src/lib/canvas-store.check.ts
import assert from "node:assert/strict";

// A plain in-memory localStorage, and a Canvas that answers only when told to, so a request can be left in flight.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
let answer = () => {};
globalThis.fetch = (async () => {
  await new Promise<void>((resolve) => (answer = resolve));
  return Response.json({ state: "ok", courses: 1, assignments: [] });
}) as typeof fetch;
const { clearCanvas, readCanvas, syncCanvas } = await import("./canvas-store.ts");

const link = { base: "https://sjsu.instructure.com", token: "1234~abcdefghijklmnopqrstuvwxyz" };
const connecting = syncCanvas("acct", link);
answer();
await connecting;
assert.deepEqual(readCanvas("acct"), link, "Connect keeps the link Canvas accepted");

// The page-load sync still in flight when the person taps Disconnect or Sign out never writes the token back.
const again = syncCanvas("acct");
clearCanvas("acct");
answer();
assert.equal((await again)?.state, "ok");
assert.equal(readCanvas("acct"), null, "Disconnect stays done");

console.log("canvas-store self-check passed");
