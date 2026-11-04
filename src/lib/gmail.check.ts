// Self-check for gmail.ts's day mail, asking mail and one email in full, against a stubbed Gmail: node src/lib/gmail.check.ts
import assert from "node:assert/strict";

const { GmailError, addressOf, asks, cleanBody, getRecentEmail, readMessage } = await import("./gmail.ts");

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

// "Show all mail" (Nov 4): the newest 20 in the inbox from every tab, no-reply and bulk senders too; senderless mail still out.
urls.length = 0;
const everything = await getRecentEmail("tok", true);
assert.deepEqual(Object.fromEntries(new URL(urls[0]).searchParams), { maxResults: "20", q: "in:inbox" });
assert.deepEqual(
  everything.map((item) => item.id),
  mail.filter(({ id }) => id !== "m5").map(({ id }) => id),
);

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
