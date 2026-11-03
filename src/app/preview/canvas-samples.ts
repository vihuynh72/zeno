// Made-up Canvas work for the /preview gallery, over the next two weeks around the real clock. Importing this keeps the
// connected sheet's list in this browser (as src/lib/canvas-store.ts does after a sync) and answers /api/canvas itself,
// so the gallery never reaches a real Canvas or deletes a signed-in person's Canvas deadlines.
import type { Deadline, Memory } from "@/lib/day";
import type { CanvasItem } from "@/lib/canvas-store";
import { addDays, browserZone, instantAt } from "@/components/desk-rows";
import { localDate } from "@/lib/tz";

export const SAMPLE_CANVAS = { account: "sample-canvas", linked: true };

// [course, title, kind, days from today, due time in minutes past midnight], as canvas.ts cleans them.
const WORK: [string, string, CanvasItem["kind"], number, number][] = [
  ["CHEM 1A", "Lab 6 pre-lab questions", "assignment", 0, 720],
  ["HIST 110", "Reading response 7", "assignment", 0, 1439],
  ["BIO 101", "Quiz 6 (Ch. 6)", "quiz", 1, 540],
  ["CS 146", "Homework 9 - Hash Tables, Separate Chaining and Linear Probing", "assignment", 2, 1439],
  ["ENGL 1A", "Peer review: Argument essay draft and comments on two classmates' theses", "discussion", 3, 1020],
  ["MATH 30", "Problem set 8", "assignment", 4, 1439],
  ["CS 146", "Quiz 7 (Ch. 7)", "quiz", 6, 600],
  ["HIST 110", "Week 11 discussion", "discussion", 7, 1439],
  ["BIO 101", "Lab 7 report: Enzyme kinetics", "assignment", 9, 1439],
  ["MATH 30", "Midterm 2", "exam", 11, 810],
  ["ENGL 1A", "Argument essay final draft", "assignment", 13, 1439],
];

const today = localDate(browserZone());
const list: CanvasItem[] = WORK.map(([course, title, kind, days, minutes], i) => ({
  id: `sample-${i}`,
  course,
  title,
  due: new Date(instantAt(addDays(today, days), minutes, browserZone())).toISOString(),
  kind,
  url: "https://sample.instructure.com/courses/1/assignments/1",
}));

// Memory sums these up in one line; Today shows the soonest five.
export const CANVAS_MEMORIES: Memory[] = WORK.map(([course, title], i) => ({
  id: `c${i}`,
  text: `${course}: ${title}`,
  createdAt: "2026-11-02T18:00:00Z",
  group: "projects",
  source: "canvas",
}));
export const CANVAS_DEADLINES: Deadline[] = WORK.map(([course, title, , days]) => ({ title: `${course}: ${title}`, date: addDays(today, days), daysLeft: days }));

if (typeof window !== "undefined") {
  try {
    const link = { base: "https://sample.instructure.com", token: "" };
    localStorage.setItem(`zeno.canvas.${SAMPLE_CANVAS.account}`, JSON.stringify({ v: 1, link, briefs: [], list, syncedAt: new Date().toISOString() }));
  } catch {
    // Blocked storage: the sheet shows Connect instead.
  }
  const real = window.fetch.bind(window);
  window.fetch = (input, init) =>
    new URL(input instanceof Request ? input.url : String(input), location.href).pathname === "/api/canvas"
      ? Promise.resolve(Response.json({ state: "error" }, { status: 503 }))
      : real(input, init);
}
