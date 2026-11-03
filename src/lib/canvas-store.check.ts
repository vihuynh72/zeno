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
let reply: object = { state: "ok", courses: 1, assignments: [] };
let dropped = async () => Response.json({ state: "ok" });
const methods: string[] = [];
globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  methods.push(init?.method ?? "GET");
  if (init?.method === "DELETE") return dropped();
  await new Promise<void>((resolve) => (answer = resolve));
  return Response.json(reply);
}) as typeof fetch;
const { canvasBriefs, canvasList, clearCanvas, dropCanvasDeadlines, readCanvas, syncCanvas } = await import("./canvas-store.ts");

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
assert.deepEqual(methods, ["POST", "POST", "DELETE"], "and the deadlines that sync saved on the server are deleted again");

// A link kept before the list was (Nov 2) still reads; the sheet then names only the school.
store.set("zeno.canvas.old", JSON.stringify({ v: 1, link, briefs: [], syncedAt: "2026-11-01T18:00:00.000Z" }));
assert.deepEqual(readCanvas("old"), link);
assert.equal(canvasList("old"), null);

// Its next sync keeps every unsubmitted piece of work for the sheet, without instructions (only the briefs carry them).
const essay = {
  id: "assignment-1",
  course: "HIST 110",
  title: "Essay 2",
  due: "2026-11-06T07:59:00.000Z",
  kind: "assignment",
  submitted: false,
  url: "https://sjsu.instructure.com/courses/1/assignments/1",
  instructions: "Argue one claim in 600 words.",
};
const quiz = { ...essay, id: "quiz-2", course: "BIO 101", title: "Quiz 5", kind: "quiz", submitted: true, instructions: null };
reply = { state: "ok", courses: 2, assignments: [essay, quiz] };
const synced = syncCanvas("old");
answer();
await synced;
assert.deepEqual(canvasList("old"), [{ id: "assignment-1", course: "HIST 110", title: "Essay 2", due: essay.due, kind: "assignment", url: essay.url }]);
assert.deepEqual(canvasBriefs("old"), [{ title: "Essay 2", course: "HIST 110", due: essay.due, instructions: essay.instructions }]);
clearCanvas("old");
assert.equal(canvasList("old"), null, "Disconnect clears the list with the link");

// Disconnect's DELETE says whether the saved Canvas deadlines are gone, so the sheet can offer to try again.
assert.equal(await dropCanvasDeadlines(), true);
dropped = async () => Response.json({ state: "error" }, { status: 500 });
assert.equal(await dropCanvasDeadlines(), false, "the database failed");
dropped = async () => {
  throw new TypeError("Failed to fetch");
};
assert.equal(await dropCanvasDeadlines(), false, "offline");

console.log("canvas-store self-check passed");
