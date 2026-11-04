// Self-check for gmail.ts's day mail, asking mail and one email in full, against a stubbed Gmail: node src/lib/gmail.check.ts
import assert from "node:assert/strict";

const { GmailError, addressOf, asks, cleanBody, getRecentEmail, getWaiting, readMessage } = await import("./gmail.ts");

// Asking mail (Vi, Nov 3): a "?" or a request's words in the subject or snippet, in any case, never in mail the person
// sent, and never a link's "?".
assert.equal(asks("Office hours?", "", false), true);
assert.equal(asks("Lab 3", "Could you send the slides by Friday", false), true);
assert.equal(asks("RSVP: club fair", "", false), true);
assert.equal(asks("Lab 3 grades", "PLEASE check the rubric", false), true, "any case");
assert.equal(asks("Meeting time", "Let me know if Wednesday at 2 works", false), true, "a request without a ?");
assert.equal(asks("Re: meeting time", "Does Wednesday at 2 work for you?", true), false, "mail they sent never asks");
assert.equal(asks("Lab 3 posted", "Slides at https://canvas.example.edu/courses/1?module=2 and www.example.edu/a?b=1", false), false, "a link's ?");
assert.equal(asks("Your order confirmation", "Thanks for your order.", false), false, "confirmation is not confirm");
assert.equal(asks("Pleased to share", "The lab moved to room 12.", false), false, "pleased is not please");
assert.equal(addressOf('"Patel, Ana" <Ana.Patel@School.edu>'), "ana.patel@school.edu");
assert.equal(addressOf(" ana@school.edu "), "ana@school.edu");

// Newest first, as Gmail lists them; the query already keeps the bulk tabs out, the sender and label rules are the backstop.
const message = (id: string, from: string | null, labels: string[] = ["INBOX"]) => ({
  id,
  snippet: `About ${id}`,
  labelIds: labels,
  payload: { headers: [...(from ? [{ name: "From", value: from }] : []), { name: "Subject", value: `Subject ${id}` }] },
});
const mail = [
  message("m1", "Prof Kim <kim@sjsu.edu>", ["INBOX", "UNREAD"]),
  message("m2", "Canvas <notifications@instructure.com>"),
  message("m3", "GitHub <noreply@github.com>", ["INBOX", "UNREAD"]),
  message("m3a", "Apple <no_reply@email.apple.com>"),
  message("m3b", "Bank <do_not_reply@bank.example>"),
  message("m4", "Shop <deals@shop.example>", ["INBOX", "CATEGORY_UPDATES"]),
  message("m5", null),
  { ...message("m6", "Ana <m6@sjsu.edu>"), internalDate: String(Date.parse("2026-11-03T16:00:00Z")) },
  ...["m7", "m8", "m9", "m10", "m11"].map((id) => message(id, `Ana <${id}@sjsu.edu>`)),
];
const urls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  urls.push(url);
  assert.equal(new Headers(init?.headers).get("authorization"), "Bearer tok");
  if (url.includes("/messages?")) return Response.json({ messages: mail.map(({ id }) => ({ id })) });
  return Response.json(mail.find(({ id }) => url.includes(`/messages/${id}?`)));
}) as typeof fetch;

const emails = await getRecentEmail("tok");
const list = new URL(urls[0]);
assert.equal(list.pathname, "/gmail/v1/users/me/messages");
assert.deepEqual(Object.fromEntries(list.searchParams), {
  maxResults: "15",
  q: "in:inbox -category:promotions -category:social -category:updates -category:forums",
});
assert.equal(urls.length, 1 + mail.length, "one list, one metadata read per message");
assert.deepEqual(
  emails.map((item) => item.id),
  ["m1", "m6", "m7", "m8", "m9", "m10"],
  "no notifications, no-reply, bulk-tab or senderless mail, and at most 6",
);
assert.deepEqual(emails[0], { id: "m1", from: "Prof Kim <kim@sjsu.edu>", subject: "Subject m1", snippet: "About m1", unread: true });
assert.equal(emails[1].unread, false);
assert.equal(emails[1].at, "2026-11-03T16:00:00.000Z", "when it came, from Gmail's internalDate");

// "Show all mail" (Nov 4): the newest 20 in the inbox from every tab, no-reply and bulk senders too; senderless mail still out.
urls.length = 0;
const everything = await getRecentEmail("tok", true);
assert.deepEqual(Object.fromEntries(new URL(urls[0]).searchParams), { maxResults: "20", q: "in:inbox" });
assert.deepEqual(
  everything.map((item) => item.id),
  mail.filter(({ id }) => id !== "m5").map(({ id }) => id),
);

// "Waiting on" (Nov 4): threads of mail she sent 3 to 14 days ago whose last message is still hers, 3+ days old, to
// someone else (the first recipient, a quoted comma kept) and not a no-reply address; at most 3, newest first.
const NOW = Date.parse("2026-11-04T18:00:00Z");
const DAY = 86_400_000;
const sentMsg = (id: string, to: string, daysAgo: number, labels = ["SENT"]) => ({
  id,
  labelIds: labels,
  internalDate: String(NOW - daysAgo * DAY),
  payload: { headers: [{ name: "To", value: to }, { name: "Subject", value: `About ${id}` }] },
});
const threads: Record<string, { messages: object[] }> = {
  t1: { messages: [sentMsg("a1", '"Patel, Ana" <ana@school.edu>, dana@school.edu', 4)] },
  t2: { messages: [sentMsg("b1", "kim@school.edu", 6), sentMsg("b2", "me@school.edu", 5, ["INBOX"])] },
  t3: { messages: [sentMsg("c1", "lee@school.edu", 9)] },
  t4: { messages: [sentMsg("d1", "noreply@bank.example", 5)] },
  t5: { messages: [sentMsg("e1", "Me <ME@school.edu>", 7)] },
  t6: { messages: [sentMsg("f1", "ruth@school.edu", 2)] },
  t7: { messages: [sentMsg("g1", "sam@school.edu", 4)] },
};
urls.length = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  urls.push(url);
  if (url.includes("/messages?")) return Response.json({ messages: ["t1", "t2", "t1", "t3", "t4", "t5", "t6", "t7"].map((threadId, i) => ({ id: `x${i}`, threadId })) });
  const id = /\/threads\/(\w+)\?/.exec(url)?.[1] ?? "";
  return id === "t3" ? new Response("boom", { status: 500 }) : Response.json(threads[id]);
}) as typeof fetch;
const waiting = await getWaiting("tok", "me@school.edu", NOW);
assert.deepEqual(Object.fromEntries(new URL(urls[0]).searchParams), { maxResults: "10", q: "in:sent older_than:3d newer_than:14d" });
assert.equal(urls.length, 1 + 6, "each thread read once, at most 6");
assert.deepEqual(waiting, [{ id: "a1", to: '"Patel, Ana" <ana@school.edu>', subject: "About a1", sentAt: new Date(NOW - 4 * DAY).toISOString() }], "answered, failed, no-reply, to herself and too new all left out; t7 is past the 6 threads read");

// One email in full for the Desk: format=full with the person's token, the plain part over the HTML one, cleaned like
// the scan's (no quoted reply, links as [link]) with its paragraphs, capped at 6,000 characters; Gmail's 404 stays one.
const part = (mimeType: string, text: string) => ({ mimeType, body: { data: Buffer.from(text).toString("base64url") } });
const full = {
  id: "msg123",
  internalDate: String(Date.parse("2026-11-03T17:05:00Z")),
  payload: {
    mimeType: "multipart/alternative",
    headers: [{ name: "From", value: "Prof Patel <Patel@school.edu>" }, { name: "Subject", value: "Meeting time" }],
    parts: [
      part("text/plain", "Hi Maya,\n\nDoes Wednesday at 2 or Thursday at 11 work for you?\n\nSlides: https://x.example/s\n\nOn Mon, Nov 2, 2026 at 9:00 AM Maya wrote:\n> an old line"),
      part("text/html", "<p>The HTML copy</p>"),
    ],
  },
};
const long = { id: "long456", payload: { headers: [{ name: "From", value: "ana@school.edu" }], ...part("text/html", `<p>${"word ".repeat(2000)}</p>`) } };

// A forward with nothing added, or only a greeting, opens on the message it carries (Nov 4: it opened as "This email has
// no text."): that message's From and Subject lines, then its words, cleaned the same way (links and long numbers out,
// its own quoted reply cut). A forward or reply with words of its own keeps only them.
const forwarded = [
  "---------- Forwarded message ---------",
  "From: Prof Patel <patel@school.edu>",
  "Date: Mon, Nov 2, 2026 at 9:00 AM",
  "Subject: Lab 3 moved to Friday",
  "To: Maya Lin <maya@school.edu>",
  "",
  "",
  "Hi all,",
  "",
  "Lab 3 is now due Friday. Slides: https://canvas.example.edu/x?y=1",
  "Room code 12345678.",
  "",
  "On Sun, Nov 1, 2026 at 8:00 AM Ana <ana@school.edu> wrote:",
  "> an older line",
].join("\n");
const carried = "From: Prof Patel <patel@school.edu>\nSubject: Lab 3 moved to Friday\n\nHi all,\n\nLab 3 is now due Friday. Slides: [link]\nRoom code [number].";
assert.equal(cleanBody(forwarded), carried, "a forward with no words of its own");
assert.equal(cleanBody(`Hi Maya,\n\n${forwarded}`), carried, "a greeting only");
assert.equal(cleanBody(`Can you check the new date?\n\n${forwarded}`), "Can you check the new date?", "its own words keep the cut");
assert.equal(cleanBody("Sounds good, see you then.\n\nOn Mon, Nov 2, 2026 at 9:00 AM Ana <ana@school.edu> wrote:\n> Lab at 2?"), "Sounds good, see you then.", "a reply keeps the cut");
assert.equal(cleanBody("On Mon, Nov 2, 2026 at 9:00 AM Ana <ana@school.edu> wrote:\n> Lab at 2?"), "", "a reply with nothing added is no forward");
assert.equal(
  cleanBody("\r\n________________________________\r\nFrom: Ana Lopez <ana@school.edu>\r\nSent: Monday, November 2, 2026 9:00 AM\r\nTo: Maya\r\nSubject: Rides\r\n\r\nCan you drive Saturday?\r\n"),
  "From: Ana Lopez <ana@school.edu>\nSubject: Rides\n\nCan you drive Saturday?",
  "Outlook's forward",
);
assert.equal(cleanBody(`---------- Forwarded message ---------\nFrom: Maya <maya@school.edu>\nSubject: Fwd: Lab 3\n\n${forwarded}`), `From: Maya <maya@school.edu>\nSubject: Fwd: Lab 3\n\n${carried}`, "a forward of a forward");
const forwardMail = { id: "fwd789", payload: { headers: [{ name: "From", value: "Maya <maya@school.edu>" }, { name: "Subject", value: "Fwd: Lab 3 moved to Friday" }], ...part("text/plain", forwarded) } };

const reads: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  reads.push(url);
  assert.equal(new Headers(init?.headers).get("authorization"), "Bearer tok");
  const found = [full, long, forwardMail].find(({ id }) => url.includes(`/messages/${id}?`));
  return found ? Response.json(found) : Response.json({ error: { code: 404, message: "Requested entity was not found." } }, { status: 404 });
}) as typeof fetch;
assert.deepEqual(await readMessage("tok", "msg123"), {
  from: "Prof Patel <Patel@school.edu>",
  address: "patel@school.edu",
  subject: "Meeting time",
  date: "2026-11-03T17:05:00.000Z",
  text: "Hi Maya,\n\nDoes Wednesday at 2 or Thursday at 11 work for you?\n\nSlides: [link]",
});
assert.equal(new URL(reads[0]).pathname, "/gmail/v1/users/me/messages/msg123");
assert.equal(new URL(reads[0]).searchParams.get("format"), "full");
const longMail = await readMessage("tok", "long456");
assert.deepEqual([longMail.text.length, longMail.subject], [6000, "(no subject)"], "the HTML part, capped");
await assert.rejects(readMessage("tok", "gone789"), (error) => error instanceof GmailError && error.status === 404);
assert.equal((await readMessage("tok", "fwd789")).text, carried, "a forward opens on what it carries");

console.log("gmail self-check passed");
