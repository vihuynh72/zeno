// Self-check for gmail.ts's day mail, against a stubbed Gmail: node src/lib/gmail.check.ts
import assert from "node:assert/strict";

const { getRecentEmail } = await import("./gmail.ts");

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

console.log("gmail self-check passed");
