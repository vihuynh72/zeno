// The person's Canvas link (school address and personal access token) and the briefs of their soonest assignments,
// kept only in this browser, per account, like the vault (src/lib/vault.ts). The token leaves the browser only in the
// body of POST /api/canvas, which uses it for that one request and never stores or logs it. Cleared at sign out.
// Storage can be missing or throw (private windows, blocked site data): reads fall back to nothing, writes are skipped.
import type { CanvasBrief, CanvasResponse } from "@/lib/day";

export type CanvasLink = { base: string; token: string };
type Stored = { v: 1; link: CanvasLink; briefs: CanvasBrief[]; syncedAt: string };

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
export const clearCanvas = (account: string) => write(account, null);

// Reads Canvas through POST /api/canvas. A link is saved only once Canvas accepted it, with the briefs of the 3
// soonest unsubmitted assignments; a refused token (bad-token, bad-url, not-allowed) forgets the saved link, so the
// account menu offers Connect Canvas again. Network trouble keeps everything as it was.
export async function syncCanvas(account: string, link: CanvasLink | null = readCanvas(account)): Promise<CanvasResponse | null> {
  if (!link) return null;
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base: link.base, token: link.token }),
  })
    .then((response) => response.json() as Promise<CanvasResponse>)
    .catch((): CanvasResponse => ({ state: "error" }));
  if (res.state === "ok") {
    const briefs = res.assignments
      .filter((item) => !item.submitted && item.instructions)
      .slice(0, 3)
      .map(({ title, course, due, instructions }) => ({ title, course, due, instructions: instructions ?? "" }));
    write(account, { v: 1, link, briefs, syncedAt: new Date().toISOString() });
  } else if (res.state === "bad-token" || res.state === "bad-url" || res.state === "not-allowed") {
    if (readCanvas(account)?.token === link.token) clearCanvas(account);
  }
  return res;
}
