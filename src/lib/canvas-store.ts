// The person's Canvas link (school address and personal access token), the briefs of their soonest assignments and the
// last sync's list for the Canvas sheet, kept only in this browser, per account, like the vault (src/lib/vault.ts). The
// token leaves the browser only in the body of POST /api/canvas, which uses it for that one request and never stores or
// logs it. Cleared at Disconnect and sign out.
// Storage can be missing or throw (private windows, blocked site data): reads fall back to nothing, writes are skipped.
import type { CanvasAssignment, CanvasBrief, CanvasResponse } from "@/lib/day";

export type CanvasLink = { base: string; token: string };
// A row of the Canvas sheet: no instructions (only the briefs carry those) and nothing about the token.
export type CanvasItem = Pick<CanvasAssignment, "id" | "course" | "title" | "due" | "kind" | "url">;
// list is missing from values kept before it existed (Nov 2).
type Stored = { v: 1; link: CanvasLink; briefs: CanvasBrief[]; list?: CanvasItem[]; syncedAt: string };

const key = (account: string) => `zeno.canvas.${account}`;

function read(account: string): Stored | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) ?? "null") as Stored | null;
    return raw?.v === 1 && typeof raw.link?.base === "string" && typeof raw.link?.token === "string" && Array.isArray(raw.briefs) ? raw : null;
  } catch {
    return null;
  }
}

function write(account: string, stored: Stored | null) {
  try {
    if (stored) localStorage.setItem(key(account), JSON.stringify(stored));
    else localStorage.removeItem(key(account));
  } catch {
    // Nothing kept: the next open asks to connect again.
  }
}

export const readCanvas = (account: string): CanvasLink | null => read(account)?.link ?? null;
export const canvasBriefs = (account: string): CanvasBrief[] => read(account)?.briefs ?? [];
// The last sync's unsubmitted work, soonest first; null when the link was kept before the list was.
export const canvasList = (account: string): CanvasItem[] | null => {
  const list = read(account)?.list;
  return Array.isArray(list) ? list : null;
};
export const clearCanvas = (account: string) => write(account, null);

// Reads Canvas through POST /api/canvas. A link is saved only once Canvas accepted it, with the briefs of the 3
// soonest unsubmitted assignments and the list of all of them; a refused token (bad-token, bad-url, not-allowed)
// forgets the saved link, so the account menu offers Connect Canvas again. Network trouble keeps everything as it was.
// `connect` is a link typed in now; without it the saved link is read again, and its answer is kept only while that
// link is still saved, so a Disconnect or Sign out during the request stays done, on the server too.
export async function syncCanvas(account: string, connect?: CanvasLink): Promise<CanvasResponse | null> {
  const link = connect ?? readCanvas(account);
  if (!link) return null;
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base: link.base, token: link.token }),
  })
    .then((response) => response.json() as Promise<CanvasResponse>)
    .catch((): CanvasResponse => ({ state: "error" }));
  if (res.state === "ok" && (connect || readCanvas(account)?.token === link.token)) {
    const todo = res.assignments.filter((item) => !item.submitted);
    const briefs = todo
      .filter((item) => item.instructions)
      .slice(0, 3)
      .map(({ title, course, due, instructions }) => ({ title, course, due, instructions: instructions ?? "" }));
    const list = todo.map(({ id, course, title, due, kind, url }) => ({ id, course, title, due, kind, url }));
    write(account, { v: 1, link, briefs, list, syncedAt: new Date().toISOString() });
  } else if (res.state === "ok" && !readCanvas(account)) {
    // Disconnected while this sync ran: the deadlines it saved after Disconnect's DELETE are deleted again.
    await fetch("/api/canvas", { method: "DELETE" }).catch(() => null);
  } else if (res.state === "bad-token" || res.state === "bad-url" || res.state === "not-allowed") {
    if (readCanvas(account)?.token === link.token) clearCanvas(account);
  }
  return res;
}
