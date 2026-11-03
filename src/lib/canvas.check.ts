// Self-check for canvas.ts with Canvas stubbed (no network, no database): node src/lib/canvas.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// canvas.ts imports through the @/ alias, which plain node cannot resolve on its own.
registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context),
});
const { CanvasError, canvasAssignments, canvasBase, canvasDeadlines, htmlText } = await import("./canvas.ts");

// ---- The school's address: only https://<school>.instructure.com, since the server fetches it.
const SJSU = "https://sjsu.instructure.com";
for (const raw of [
  "sjsu.instructure.com",
  "sjsu.instructure.com/",
  "https://sjsu.instructure.com",
  "https://sjsu.instructure.com/",
  "https://sjsu.instructure.com/courses/12",
  "HTTPS://SJSU.Instructure.com/courses/12/",
  "  sjsu.instructure.com?login=1 ",
]) {
  assert.equal(canvasBase(raw), SJSU, raw);
}
assert.equal(canvasBase("canvas.instructure.com"), "https://canvas.instructure.com");
assert.equal(canvasBase("sjsu.beta.instructure.com/courses/1"), "https://sjsu.beta.instructure.com");
for (const raw of [
  "http://sjsu.instructure.com",
  "ftp://sjsu.instructure.com",
  "sjsu.instructure.com:8443",
  "https://sjsu.instructure.com:443/",
  "https://user:pass@sjsu.instructure.com",
  "user@sjsu.instructure.com",
  "https://sjsu.instructure.com@evil.com",
  "https://10.0.0.1",
  "127.0.0.1",
  "[::1]",
  "localhost",
  "https://localhost:3000",
  "evil.com",
  "https://evil.com/sjsu.instructure.com",
  "sjsu.instructure.com.evil.com",
  "instructure.com",
  ".instructure.com",
  "sjsu.instructure.com.",
  "//sjsu.instructure.com",
  "javascript:alert(1)",
  "sjsu instructure.com",
  "ѕjsu.instructure.com",
  "",
  42,
  null,
  undefined,
]) {
  assert.equal(canvasBase(raw), null, String(raw));
}

// ---- Instructions: HTML to plain words, entities decoded once, at most 800 characters.
assert.equal(
  htmlText(
    "<p>Read <b>chapter&nbsp;4</b> &amp; answer Q1&ndash;Q3.</p>\n\n<ul><li>Don&#39;t use AI</li><li>Cite &lt;2&gt; sources &#x2014; MLA</li></ul><script>alert(1)</script><style>p { color: red }</style>",
  ),
  "Read chapter 4 & answer Q1–Q3. Don't use AI Cite <2> sources — MLA",
);
assert.equal(htmlText("Use &amp;lt;br&amp;gt; tags &bogus; &constructor; &#0;."), "Use &lt;br&gt; tags &bogus; &constructor; .");
assert.equal(htmlText(`<p>${"word ".repeat(400)}</p>`).length, 800);

// ---- The planner, with Canvas stubbed: what each request asked for, and what each URL answers.
const TOKEN = "1234~AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const NOW = new Date("2026-11-02T18:00:00Z"); // Monday 10 AM in Los Angeles
const LA = "America/Los_Angeles";
const realFetch = globalThis.fetch;
const calls: { url: URL; init?: RequestInit }[] = [];
let answer: (url: URL) => Response = () => new Response("{}", { status: 500 });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  calls.push({ url, init });
  return answer(url);
}) as typeof fetch;
const json = (data: unknown, link?: string) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json", ...(link && { link }) } });
const page = (n: number, host = SJSU) => `${host}/api/v1/planner/items?page=${n}&per_page=100`;
const links = (next: string) => `<${page(1)}>; rel="current",<${next}>; rel="next",<${page(1)}>; rel="first"`;

const course = (id: number, name: string) => ({ context_type: "Course", course_id: id, context_name: name });
const CS = course(101, "CS 146 - Data Structures");
const BIO = course(102, "BIO 121");
const HIST = course(103, "HIST 110");
const MATH = course(104, "MATH 30");
const open = { submitted: false, excused: false, missing: false };
const work = (type: string, at: typeof CS, id: number, title: string, due: string | null, submissions: object | false = open, html_url = `/courses/${at.course_id}/assignments/${id}`) => ({
  ...at,
  plannable_id: String(id),
  plannable_type: type,
  plannable: { id, title, due_at: due },
  plannable_date: due,
  submissions,
  html_url,
});
const PAGE_1 = [
  work("assignment", CS, 11, "Project 2: Linked Lists", "2026-11-07T07:59:00Z"),
  work("quiz", BIO, 21, "  Quiz\n4 ", "2026-11-04T17:00:00Z", open, `${SJSU}/courses/102/quizzes/21`),
  // A discussion's due date can be only the planner date.
  { ...work("discussion_topic", HIST, 31, "Week 10 discussion", null, open, "/courses/103/discussion_topics/31"), plannable_date: "2026-11-05T06:59:00Z" },
  {
    ...BIO,
    plannable_id: "41",
    plannable_type: "calendar_event",
    plannable: { id: 41, title: "Midterm 2", description: "<p>Chapters 5&ndash;8.</p>", start_at: "2026-11-10T17:00:00Z" },
    plannable_date: "2026-11-10T17:00:00Z",
    submissions: false,
    html_url: "/calendar?event_id=41&include_contexts=course_102",
  },
  { ...work("calendar_event", BIO, 42, "Office hours", "2026-11-03T22:00:00Z", false), plannable: { id: 42, title: "Office hours" } },
  // Their own calendar on Canvas: no course, so no exam, and never their name as a course.
  { context_type: "User", context_name: "Maya Tran", plannable_id: "43", plannable_type: "calendar_event", plannable: { title: "Driving test" }, plannable_date: "2026-11-06T17:00:00Z", submissions: false },
  work("assignment", CS, 12, "Lab 5", "2026-11-03T07:59:00Z", { ...open, submitted: true }, "/courses/101/assignments/12/submissions/9"),
  work("assignment", HIST, 13, "Reading response 3", "2026-11-03T20:00:00Z", { ...open, excused: true }),
  work("assignment", CS, 14, "Lab 6", "2026-11-09T07:59:00Z", open, "http://evil.example/phish"),
  work("assignment", HIST, 15, "Reflection: my visa interview", "2026-11-11T07:59:00Z"),
  // The planner lists it by its to-do date; the due date is past the 14 days.
  { ...work("discussion_topic", CS, 16, "Group essay", "2026-11-20T07:59:00Z", open, "/courses/101/discussion_topics/16"), plannable_date: "2026-11-08T07:59:00Z" },
  work("assignment", CS, 17, "Bonus reading", null),
  { ...work("wiki_page", course(105, "ART 12"), 51, "Studio rules", null), plannable: { title: "Studio rules", todo_date: "2026-11-04T17:00:00Z" } },
  { ...work("announcement", CS, 52, "Room change", null), plannable_date: "2026-11-02T17:00:00Z" },
  { plannable_id: "53", plannable_type: "planner_note", plannable: { title: "Buy a lab coat" }, plannable_date: "2026-11-04T17:00:00Z", submissions: false },
  null,
  "junk",
];
const DETAILS: Record<string, unknown> = {
  "/api/v1/courses/102/quizzes/21": { description: "<p>Covers <b>enzymes</b> &amp; kinetics.</p>" },
  "/api/v1/courses/103/discussion_topics/31": { message: "<p>Post one question about the reading, then reply to two classmates.</p>" },
  "/api/v1/courses/101/assignments/11": { description: `<h2>Project 2</h2><p>${"Implement a doubly linked list. ".repeat(40)}</p>` },
};
answer = (url) => {
  if (url.pathname === "/api/v1/planner/items") {
    const n = url.searchParams.get("page") ?? "1";
    if (n === "1") return json(PAGE_1, links(page(2)));
    if (n === "2") return json([work("assignment", MATH, 61, "Problem set 6", "2026-11-12T07:59:00Z")], links(page(3)));
    if (n === "3") return json([work("assignment", MATH, 62, "Problem set 7", "2026-11-14T07:59:00Z")], links(page(4)));
    return json([work("assignment", MATH, 63, "Problem set 8", "2026-11-15T07:59:00Z")]);
  }
  return url.pathname in DETAILS ? json(DETAILS[url.pathname]) : new Response("not found", { status: 404 });
};

try {
  const { courses, assignments } = await canvasAssignments(SJSU, TOKEN, NOW);
  const planner = calls.filter((call) => call.url.pathname === "/api/v1/planner/items");
  assert.deepEqual(planner.map((call) => call.url.searchParams.get("page") ?? "1"), ["1", "2", "3"], "three pages at most");
  const first = planner[0].url.searchParams;
  assert.deepEqual(
    [first.get("start_date"), first.get("end_date"), first.get("per_page")],
    ["2026-11-02T18:00:00.000Z", "2026-11-16T18:00:00.000Z", "100"],
    "the next 14 days, 100 a page",
  );
  for (const call of calls) {
    assert.equal(call.url.origin, SJSU, "only the school's Canvas");
    assert.equal(new Headers(call.init?.headers).get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(call.init?.redirect, "error", "a redirect never carries the token elsewhere");
    assert.ok(call.init?.signal instanceof AbortSignal, "every request has a deadline");
  }
  assert.equal(courses, 5, "every course the planner showed");
  assert.deepEqual(
    assignments.map((item) => [item.kind, item.course, item.title, item.due, item.submitted, item.url]),
    [
      ["assignment", "CS 146 - Data Structures", "Lab 5", "2026-11-03T07:59:00.000Z", true, `${SJSU}/courses/101/assignments/12/submissions/9`],
      ["assignment", "HIST 110", "Reading response 3", "2026-11-03T20:00:00.000Z", true, `${SJSU}/courses/103/assignments/13`],
      ["quiz", "BIO 121", "Quiz 4", "2026-11-04T17:00:00.000Z", false, `${SJSU}/courses/102/quizzes/21`],
      ["discussion", "HIST 110", "Week 10 discussion", "2026-11-05T06:59:00.000Z", false, `${SJSU}/courses/103/discussion_topics/31`],
      ["assignment", "CS 146 - Data Structures", "Project 2: Linked Lists", "2026-11-07T07:59:00.000Z", false, `${SJSU}/courses/101/assignments/11`],
      ["assignment", "CS 146 - Data Structures", "Lab 6", "2026-11-09T07:59:00.000Z", false, SJSU],
      ["exam", "BIO 121", "Midterm 2", "2026-11-10T17:00:00.000Z", false, `${SJSU}/calendar?event_id=41&include_contexts=course_102`],
      ["assignment", "HIST 110", "Reflection: my visa interview", "2026-11-11T07:59:00.000Z", false, `${SJSU}/courses/103/assignments/15`],
      ["assignment", "MATH 30", "Problem set 6", "2026-11-12T07:59:00.000Z", false, `${SJSU}/courses/104/assignments/61`],
      ["assignment", "MATH 30", "Problem set 7", "2026-11-14T07:59:00.000Z", false, `${SJSU}/courses/104/assignments/62`],
      ["discussion", "CS 146 - Data Structures", "Group essay", "2026-11-20T07:59:00.000Z", false, `${SJSU}/courses/101/discussion_topics/16`],
      ["assignment", "CS 146 - Data Structures", "Bonus reading", null, false, `${SJSU}/courses/101/assignments/17`],
    ],
    "soonest first; excused counts as handed in; a link off the school's Canvas becomes its home page",
  );
  assert.equal(new Set(assignments.map((item) => item.id)).size, assignments.length, "one id each");
  // The 3 soonest unsubmitted, each read from its own page; the rest wait for the next sync.
  const instructed = new Map(assignments.flatMap((item) => (item.instructions ? [[item.title, item.instructions]] : [])));
  assert.deepEqual([...instructed.keys()], ["Quiz 4", "Week 10 discussion", "Project 2: Linked Lists"]);
  assert.equal(instructed.get("Quiz 4"), "Covers enzymes & kinetics.", "a quiz's description");
  assert.equal(instructed.get("Week 10 discussion"), "Post one question about the reading, then reply to two classmates.", "a discussion's message");
  const project = instructed.get("Project 2: Linked Lists") ?? "";
  assert.ok(project.startsWith("Project 2 Implement a doubly linked list. Implement") && project.length === 800, "an assignment's description, cut");
  assert.equal(calls.length, 6, "three planner pages and three instruction pages");

  // ---- The deadlines a sync keeps: unsubmitted, due in the next 14 days, in the person's zone, never a private title.
  const deadlines = canvasDeadlines(assignments, LA, NOW);
  assert.deepEqual(deadlines, [
    { text: "BIO 121: Quiz 4, due Wednesday, November 4.", expiresOn: "2026-11-05" },
    { text: "HIST 110: Week 10 discussion, due Wednesday, November 4.", expiresOn: "2026-11-05" },
    { text: "CS 146 - Data Structures: Project 2: Linked Lists, due Friday, November 6.", expiresOn: "2026-11-07" },
    { text: "CS 146 - Data Structures: Lab 6, due Sunday, November 8.", expiresOn: "2026-11-09" },
    { text: "BIO 121: Midterm 2, due Tuesday, November 10.", expiresOn: "2026-11-11" },
    { text: "MATH 30: Problem set 6, due Wednesday, November 11.", expiresOn: "2026-11-12" },
    { text: "MATH 30: Problem set 7, due Friday, November 13.", expiresOn: "2026-11-14" },
  ]);
  assert.deepEqual(
    canvasDeadlines(assignments.filter((item) => item.title === "Week 10 discussion"), "Asia/Tokyo", NOW),
    [{ text: "HIST 110: Week 10 discussion, due Thursday, November 5.", expiresOn: "2026-11-06" }],
    "their own date",
  );
  const long = canvasDeadlines(
    [
      {
        ...assignments[2],
        course: "Introduction to Data Structures and Algorithms in Java (Section 01) Fall 2026",
        title: "Final project proposal: pick a data set, write a two-page plan and list the three questions you will answer",
      },
    ],
    LA,
    NOW,
  );
  assert.deepEqual(long, [
    {
      text: "Introduction to Data Structures and: Final project proposal: pick a data set, write a two-page plan and list the three, due Wednesday, November 4.",
      expiresOn: "2026-11-05",
    },
  ], "kept short, cut at a word: the course to 40 characters, the whole title to 120");
  const cut = (title: string) => canvasDeadlines([{ ...assignments[2], course: "", title }], LA, NOW)[0].text.replace(/, due .*$/, "");
  assert.equal(cut(`${"x".repeat(115)} abcd efgh`), `${"x".repeat(115)} abcd`, "a word that ends at the limit stays");
  assert.equal(cut("y".repeat(130)), "y".repeat(120), "one long word is cut where it crosses");

  // ---- A next page on another host is never read; an exam's instructions come with it, and a failed read leaves none.
  calls.length = 0;
  answer = (url) =>
    url.pathname === "/api/v1/planner/items"
      ? json(
          [
            { ...PAGE_1[3], plannable: { title: "Final exam", description: "<p>Bring a calculator.</p>" } },
            work("assignment", CS, 71, "Lab 7", "2026-11-12T07:59:00Z"),
            work("quiz", BIO, 72, "Quiz 5", "2026-11-12T08:59:00Z"),
          ],
          links(page(2, "https://evil.example")),
        )
      : url.pathname.endsWith("/71")
        ? new Response("oops", { status: 500 })
        : new Response("<html>not json</html>");
  const other = await canvasAssignments(SJSU, TOKEN, NOW);
  assert.deepEqual(other.assignments.map((item) => [item.kind, item.title, item.instructions]), [
    ["exam", "Final exam", "Bring a calculator."],
    ["assignment", "Lab 7", null],
    ["quiz", "Quiz 5", null],
  ]);
  assert.deepEqual(
    calls.map((call) => call.url.pathname),
    ["/api/v1/planner/items", "/api/v1/courses/101/assignments/71", "/api/v1/courses/102/quizzes/72"],
    "one planner page, and no request for the exam",
  );

  // ---- Errors: 401 is a refused token, 403 or 404 a school that turned the API off, anything else an error.
  for (const [status, state] of [[401, "bad-token"], [403, "not-allowed"], [404, "not-allowed"], [500, "error"], [302, "error"]] as const) {
    answer = () => new Response("{}", { status });
    await assert.rejects(canvasAssignments(SJSU, TOKEN, NOW), (error) => error instanceof CanvasError && error.state === state, `${status}`);
  }
  for (const body of ["<html>login</html>", '{"errors":[]}']) {
    answer = () => new Response(body);
    await assert.rejects(canvasAssignments(SJSU, TOKEN, NOW), (error) => error instanceof CanvasError && error.state === "error", body);
  }
  answer = () => {
    throw new TypeError("fetch failed: unexpected redirect");
  };
  await assert.rejects(canvasAssignments(SJSU, TOKEN, NOW), (error) => {
    assert.ok(error instanceof CanvasError && error.state === "error");
    assert.ok(!error.message.includes(TOKEN) && !error.message.includes("Bearer"), "the token is never in an error");
    return true;
  });
} finally {
  globalThis.fetch = realFetch;
}

console.log("canvas self-check passed");
