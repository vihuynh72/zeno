import { nextDate } from "@/lib/calendar";
import type { CanvasAssignment } from "@/lib/day";
import { deadlineMemory } from "@/lib/goals";
import { factVerdict, SECRETS } from "@/lib/profile";
import { localDate } from "@/lib/tz";

// Canvas LMS (https://canvas.instructure.com/doc/api/), read with the person's own personal access token for one
// request; the token is never stored or logged.

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.instructure\.com$/;

// "sjsu.instructure.com", "https://sjsu.instructure.com/courses/1" → "https://sjsu.instructure.com"; null for
// anything that is not an https://<school>.instructure.com address (the server fetches it, so no http, port,
// credentials, IP or other host).
// shortcut: custom Canvas domains (canvas.school.edu) are not supported yet; add an allowlist when a school needs one.
export function canvasBase(raw: unknown): string | null {
  const host = typeof raw === "string" ? /^(?:https:\/\/)?([^/?#]*)/i.exec(raw.trim())?.[1].toLowerCase() : undefined;
  return host && HOST.test(host) ? `https://${host}` : null;
}

type CanvasState = "bad-token" | "not-allowed" | "error";

// What went wrong, for POST /api/canvas to answer with; the message never holds the token.
export class CanvasError extends Error {
  state: CanvasState;
  constructor(state: CanvasState) {
    super(`Canvas read failed: ${state}`);
    this.state = state;
  }
}

// The planner item fields Zeno reads.
type PlannerItem = {
  plannable_id?: string | number;
  plannable_type?: string;
  plannable?: { title?: unknown; due_at?: unknown; description?: unknown } | null;
  plannable_date?: unknown;
  submissions?: false | { submitted?: boolean; excused?: boolean } | null;
  context_type?: string;
  course_id?: string | number | null;
  context_name?: unknown;
  html_url?: unknown;
};

const DAY = 86_400_000;
const KINDS = new Map<string, CanvasAssignment["kind"]>([
  ["assignment", "assignment"],
  ["quiz", "quiz"],
  ["discussion_topic", "discussion"],
]);
const EXAM = /\b(exams?|midterms?|finals?|quiz(zes)?|tests?)\b/i;
// The page and field that hold each kind's instructions; an exam's come with its planner item.
const DETAIL = { assignment: ["assignments", "description"], quiz: ["quizzes", "description"], discussion: ["discussion_topics", "message"] };
const ENTITIES = new Map(Object.entries({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–" }));

const words = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
// At most max characters, cut before the word that would cross max (one long word is cut where it crosses).
function short(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1).replace(/\s+\S*$/, "");
  return cut.length <= max ? cut : text.slice(0, max);
}

const get = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(8000) });

// A link on the school's own Canvas (relative ones resolve there), or null.
function onCanvas(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return url.origin === base ? url.href : null;
  } catch {
    return null;
  }
}

// Canvas pages are HTML: plain words, at most 800 characters. The device keeps these and every prompt gets them, so a
// link (it can carry a passcode, like sjsu.zoom.us/j/812?pwd=...) becomes [link] and a sentence with a code goes.
export function htmlText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      const hex = /^#x/i.test(name);
      const code = name.startsWith("#") ? Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10) : NaN;
      if (Number.isInteger(code)) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      return ENTITIES.get(name.toLowerCase()) ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim()
    // Cut first, so the link pattern only ever reads a few pages of text.
    .slice(0, 4000)
    .replace(/https?:\/\/\S+|www\.\S+|\b[\w-]+(\.[\w-]+)*\.[a-z]{2,}\/\S*/gi, "[link]")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !SECRETS.test(sentence))
    .join(" ");
  return [...text].slice(0, 800).join("");
}

function assignmentOf(item: PlannerItem, base: string): CanvasAssignment | null {
  const title = words(item.plannable?.title);
  const exam = item.plannable_type === "calendar_event" && item.context_type === "Course" && EXAM.test(title);
  const kind = KINDS.get(item.plannable_type ?? "") ?? (exam ? "exam" : null);
  if (!kind || !title || item.plannable_id == null) return null;
  const due = [item.plannable?.due_at, item.plannable_date].find((value) => typeof value === "string" && Number.isFinite(Date.parse(value)));
  return {
    id: `${item.plannable_type}-${item.plannable_id}`,
    course: words(item.context_name),
    title,
    due: typeof due === "string" ? new Date(due).toISOString() : null,
    kind,
    submitted: Boolean(item.submissions && (item.submissions.submitted || item.submissions.excused)),
    url: (typeof item.html_url === "string" && onCanvas(item.html_url, base)) || base,
    instructions: null,
  };
}

// Any failure leaves the item without instructions.
async function instructionsOf(item: PlannerItem, kind: CanvasAssignment["kind"], base: string, token: string): Promise<string | null> {
  let html = kind === "exam" ? item.plannable?.description : null;
  if (kind !== "exam" && item.course_id != null) {
    const [page, field] = DETAIL[kind];
    const url = `${base}/api/v1/courses/${encodeURIComponent(item.course_id)}/${page}/${encodeURIComponent(item.plannable_id ?? "")}`;
    const response = await get(url, token).catch(() => null);
    html = response?.ok ? ((await response.json().catch(() => null)) as Record<string, unknown> | null)?.[field] : null;
  }
  return (typeof html === "string" && htmlText(html)) || null;
}

// The next 14 days of the person's work: assignments, quizzes, discussions and exams (a course calendar event whose
// title says so), submitted or not, soonest first, with instructions for the 3 soonest unsubmitted ones.
export async function canvasAssignments(base: string, token: string, now = new Date()): Promise<{ courses: number; assignments: CanvasAssignment[] }> {
  const items: PlannerItem[] = [];
  const query = new URLSearchParams({ start_date: now.toISOString(), end_date: new Date(now.getTime() + 14 * DAY).toISOString(), per_page: "100" });
  let url: string | undefined = `${base}/api/v1/planner/items?${query}`;
  // Three pages at most, and a next page only on the same school's Canvas.
  for (let page = 0; url && page < 3; page++) {
    const response: Response | null = await get(url, token).catch(() => null);
    const status = response?.status;
    if (!response?.ok) throw new CanvasError(status === 401 ? "bad-token" : status === 403 || status === 404 ? "not-allowed" : "error");
    const data: unknown = await response.json().catch(() => null);
    if (!Array.isArray(data)) throw new CanvasError("error");
    items.push(...data.filter((item) => item && typeof item === "object"));
    const next: string | undefined = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get("link") ?? "")?.[1];
    url = (next && onCanvas(next, base)) || undefined;
  }
  const found = items
    .flatMap((item) => {
      const assignment = assignmentOf(item, base);
      return assignment ? [{ item, assignment }] : [];
    })
    .sort((a, b) => (a.assignment.due ?? "9999").localeCompare(b.assignment.due ?? "9999"));
  await Promise.all(
    found
      .filter(({ assignment }) => !assignment.submitted)
      .slice(0, 3)
      .map(async ({ item, assignment }) => {
        assignment.instructions = await instructionsOf(item, assignment.kind, base, token);
      }),
  );
  const courses = new Set(items.flatMap((item) => (item.course_id == null ? [] : [String(item.course_id)]))).size;
  return { courses, assignments: found.map(({ assignment }) => assignment) };
}

// Each unsubmitted item due in the next 14 days as the deadline memory Today and the first card read
// (src/lib/goals.ts deadlineMemory: "<course>: <title>, due <day>."), kept until the day after it is due in their zone.
// Text either list (src/lib/profile.ts factVerdict) rejects is skipped, as listMemories would delete it.
export function canvasDeadlines(assignments: CanvasAssignment[], timeZone: string, now = new Date()): { text: string; expiresOn: string }[] {
  return assignments.flatMap((item) => {
    if (item.submitted || !item.due) return [];
    const due = Date.parse(item.due);
    if (due < now.getTime() || due > now.getTime() + 14 * DAY) return [];
    const date = localDate(timeZone, new Date(due));
    const text = deadlineMemory({ title: short(item.course ? `${short(item.course, 40)}: ${item.title}` : item.title, 120), date });
    return factVerdict(text) ? [] : [{ text, expiresOn: nextDate(date) }];
  });
}
