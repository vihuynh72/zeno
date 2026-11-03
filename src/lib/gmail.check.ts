// Self-check for gmail.ts's day mail, asking mail and one email in full, against a stubbed Gmail: node src/lib/gmail.check.ts
import assert from "node:assert/strict";

const { GmailError, addressOf, asks, getRecentEmail, readMessage } = await import("./gmail.ts");

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
  ...["m6", "m7", "m8", "m9", "m10", "m11"].map((id) => message(id, `Ana <${id}@sjsu.edu>`)),
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
const reads: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  reads.push(url);
  assert.equal(new Headers(init?.headers).get("authorization"), "Bearer tok");
  const found = [full, long].find(({ id }) => url.includes(`/messages/${id}?`));
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

console.log("gmail self-check passed");
