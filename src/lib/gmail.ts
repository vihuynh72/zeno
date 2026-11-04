export type EmailSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  unread: boolean;
};

type GmailListResponse = {
  messages?: Array<{ id?: string }>;
};

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id?: string;
  snippet?: string;
  labelIds?: string[];
  // Milliseconds since the epoch, as a string.
  internalDate?: string;
  payload?: GmailPart & {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

function header(message: GmailMessage, name: string) {
  const found = (message.payload?.headers ?? []).find(
    (item) => item.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

export class GmailError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Gmail request failed with ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

async function gmailFetch(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new GmailError(response.status, await response.text());
  }
  return response.json();
}

// "Ana Lopez <Ana@school.edu>" and "ana@school.edu" are both ana@school.edu.
export const addressOf = (from: string) => (/<([^<>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();

// Mail that asks the person something (Vi, Nov 3: asking mail comes first): a "?" or a request's words in the subject or
// snippet, never in mail they sent. Links are left out, so a link's "?" asks nothing.
const ASKING = /\b(can you|could you|would you|will you|please|let me know|are you|do you|rsvp|confirm|reply|available|when can)\b/i;
export function asks(subject: string, snippet: string, fromSelf: boolean): boolean {
  const text = `${subject}\n${snippet}`.replace(/https?:\/\/\S+|www\.\S+/gi, " ");
  return !fromSelf && (text.includes("?") || ASKING.test(text));
}

// Gmail's Promotions, Social, Updates and Forums tabs, and no-reply senders: mail nobody answers.
const BULK = /^CATEGORY_(PROMOTIONS|SOCIAL|UPDATES|FORUMS)$/;
const NO_REPLY = /no[-_]?reply|do[-_]?not[-_]?reply|notifications?@|mailer-daemon|newsletter/i;
const IMPORTANT = "in:inbox -category:promotions -category:social -category:updates -category:forums";

// A Gmail message id as the routes accept it.
export const MAIL_ID = /^[A-Za-z0-9_-]{6,64}$/;

// Only important mail (Vi, Nov 2), people and school: the newest 15 outside the bulk tabs, without bulk or no-reply
// senders, at most 6. all: every recent email instead ("Show all mail", Nov 4), the newest 20 in the inbox from any tab.
export async function getRecentEmail(accessToken: string, all = false): Promise<EmailSummary[]> {
  const query = all ? { maxResults: "20", q: "in:inbox" } : { maxResults: "15", q: IMPORTANT };
  const list = (await gmailFetch(accessToken, `messages?${new URLSearchParams(query)}`)) as GmailListResponse;

  const ids = (list.messages ?? []).map((item) => item.id).filter(Boolean) as string[];
  const messages = await Promise.all(
    ids.map(
      (id) =>
        gmailFetch(
          accessToken,
          `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        ) as Promise<GmailMessage>,
    ),
  );

  return messages
    .flatMap((message, i) => {
      const from = header(message, "From");
      const labels = message.labelIds ?? [];
      if (!from || (!all && (NO_REPLY.test(from) || labels.some((label) => BULK.test(label))))) return [];
      return [
        {
          // The id it was read by: a made-up one could never open (Nov 4).
          id: message.id ?? ids[i],
          from,
          subject: header(message, "Subject") || "(no subject)",
          snippet: (message.snippet ?? "").slice(0, 160),
          unread: labels.includes("UNREAD"),
        },
      ];
    })
    .slice(0, all ? 20 : 6);
}

// Mail she sent 3 to 14 days ago that nobody answered ("Waiting on", Nov 4): the threads of the newest 10 she sent in
// that window, each read once for its headers; a thread whose last message is still hers, 3+ days old, to someone else
// and not a no-reply address, waits. At most 3, newest first. self: her own address.
export type Waiting = { id: string; to: string; subject: string; sentAt: string };
export async function getWaiting(accessToken: string, self: string, now = Date.now()): Promise<Waiting[]> {
  const query = { maxResults: "10", q: "in:sent older_than:3d newer_than:14d" };
  const list = (await gmailFetch(accessToken, `messages?${new URLSearchParams(query)}`)) as { messages?: { threadId?: string }[] };
  const threads = [...new Set((list.messages ?? []).flatMap((item) => (item.threadId ? [item.threadId] : [])))].slice(0, 6);
  const read = await Promise.all(
    threads.map((id) =>
      (gmailFetch(accessToken, `threads/${encodeURIComponent(id)}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`) as Promise<{ messages?: GmailMessage[] }>).catch(() => null),
    ),
  );
  return read
    .flatMap((thread) => {
      const last = thread?.messages?.at(-1);
      const at = Number(last?.internalDate);
      // The first recipient: a quoted name may hold a comma ("Patel, Ana" <ana@school.edu>).
      const to = ((last ? header(last, "To") : "").match(/(?:"[^"]*"|[^,])+/)?.[0] ?? "").trim();
      const mine = last?.labelIds?.includes("SENT") && now - at >= 3 * 86_400_000;
      if (!last?.id || !mine || !to || NO_REPLY.test(to) || addressOf(to) === self.toLowerCase()) return [];
      return [{ id: last.id, to, subject: header(last, "Subject") || "(no subject)", sentAt: new Date(at).toISOString() }];
    })
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))
    .slice(0, 3);
}

// One email read in full for the Desk (GET /api/mail/[id]) with the person's own token: cleaned and capped at 6,000
// characters in memory, and never stored, logged or sent to the model. Gmail's 404 throws as a GmailError with status 404.
export async function readMessage(
  accessToken: string,
  id: string,
): Promise<{ from: string; address: string; subject: string; date: string; text: string }> {
  const message = (await gmailFetch(accessToken, `messages/${encodeURIComponent(id)}?format=full`)) as GmailMessage;
  const from = header(message, "From");
  const plain = partText(message.payload, "text/plain");
  const at = Number(message.internalDate) || Date.parse(header(message, "Date"));
  return {
    from,
    address: addressOf(from),
    subject: header(message, "Subject") || "(no subject)",
    date: new Date(Number.isFinite(at) ? at : Date.now()).toISOString(),
    text: cleanBody(plain ?? partText(message.payload, "text/html") ?? message.snippet ?? "", plain === null, 6000),
  };
}

// One email for the profile scan: read and cleaned in memory, never stored.
export type ProfileEmail = { sent: boolean; from: string; to: string; subject: string; date: string; body: string };

// Recent mail for the profile scan: the inbox without the Promotions, Social and Forums tabs, plus Purchases,
// and some sent mail for the person's own projects and people. `after` limits it to mail since the last scan.
export async function getProfileEmails(
  accessToken: string,
  { after, inbox, sent }: { after: Date | null; inbox: number; sent: number },
): Promise<ProfileEmail[]> {
  const since = after ? `after:${Math.floor(after.getTime() / 1000)}` : "newer_than:30d";
  const queries = [
    { q: `${since} ((in:inbox -category:promotions -category:social -category:forums) OR category:purchases)`, max: inbox },
    { q: `${since} in:sent`, max: sent },
  ];
  const lists = (await Promise.all(
    queries.map(({ q, max }) => gmailFetch(accessToken, `messages?${new URLSearchParams({ maxResults: String(max), q })}`)),
  )) as GmailListResponse[];
  const ids = [...new Set(lists.flatMap((list) => (list.messages ?? []).map((item) => item.id ?? "")).filter(Boolean))];

  const messages: GmailMessage[] = [];
  // Ten at a time: Gmail limits how many reads one person can make per second.
  for (let index = 0; index < ids.length; index += 10) {
    const batch = await Promise.all(
      ids
        .slice(index, index + 10)
        .map((id) => (gmailFetch(accessToken, `messages/${id}?format=full`) as Promise<GmailMessage>).catch(() => null)),
    );
    messages.push(...batch.filter((message): message is GmailMessage => message !== null));
  }
  // Every read failing is an outage, not an empty inbox: the scan then reads this mail again next time.
  if (ids.length > 0 && messages.length === 0) throw new GmailError(502, "every message read failed");

  return messages.flatMap((message) => {
    const plain = partText(message.payload, "text/plain");
    const body = cleanBody(plain ?? partText(message.payload, "text/html") ?? message.snippet ?? "", plain === null);
    if (!body) return [];
    return [
      {
        sent: (message.labelIds ?? []).includes("SENT"),
        from: header(message, "From").slice(0, 120),
        to: header(message, "To").slice(0, 160),
        subject: header(message, "Subject").slice(0, 160),
        date: header(message, "Date").slice(0, 60),
        body,
      },
    ];
  });
}

// The first part of that type that is not an attachment, decoded.
function partText(part: GmailPart | undefined, type: string): string | null {
  if (!part) return null;
  if (part.mimeType === type && !part.filename && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const child of part.parts ?? []) {
    const found = partText(child, type);
    if (found !== null) return found;
  }
  return null;
}

// The named entities mail actually uses; numeric ones decode by code point.
const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", hellip: "…", eacute: "é", copy: "©", reg: "®", trade: "™", bull: "•", middot: "·",
};

function htmlToText(html: string): string {
  return (
    html
      .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, " ")
      // Quoted replies and signatures come last, so everything from their start goes.
      .replace(/<(div|blockquote)\b[^>]*(gmail_quote|gmail_signature|appendonsend|divRplyFwdMsg|moz-cite-prefix)[\s\S]*$/i, "")
      .replace(/<blockquote\b[\s\S]*$/i, "")
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
        const hex = /^#x/i.test(name);
        const code = name.startsWith("#") ? Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10) : NaN;
        if (Number.isInteger(code)) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
        return ENTITIES[name.toLowerCase()] ?? entity;
      })
  );
}

const QUOTE_START = [
  /^On\b[^\n]*(\n[^\n]*)?\bwrote:[ \t]*$/m,
  /^-{2,} *(Original Message|Forwarded message) *-{2,}/im,
  /^_{10,}[ \t]*$/m,
  /^From: [^\n]+\n(Sent|Date): /m,
];
const SIGNATURE_START = [/^-- ?$/m, /^(Sent from my \w+|Get Outlook for \w+)/im];
const SIGN_OFF =
  /^(best|thanks|thank you|thanks so much|many thanks|cheers|regards|best regards|kind regards|warm regards|warmly|sincerely|all the best|take care)[ \t]*[,.!]?[ \t]*$/gim;
const GREETING = /^(hi|hey|hello|dear|good (morning|afternoon|evening))\b[^\n]*$/i;
// Where a forward's message starts: Gmail's and Outlook's marker lines, or Outlook's header block on its own.
const FORWARD = /^[ \t]*(?:-{2,} *(?:Original Message|Forwarded message) *-{2,}|_{10,})[ \t]*$|^(?=From: [^\n]+\n(?:Sent|Date): )/im;
const HEADER = /^(?:(?:From|Sent|Date|To|Cc|Subject): |[ \t]+\S)/i;

// The new words of one email, at most `max` characters: no quoted replies, signatures, markup, links or long numbers. A
// forward with no words of its own but a greeting gives the message it carries instead (Nov 4: it opened as "This email
// has no text."): that message's From and Subject lines, then its own words, cleaned the same way.
// shortcut: an HTML-only forward still opens empty (htmlToText drops Gmail's quote block); read that block if one shows up.
export function cleanBody(raw: string, html = false, max = 1500): string {
  return [...newWords((html ? htmlToText(raw) : raw).replace(/\r\n?/g, "\n"))].slice(0, max).join("");
}

function newWords(full: string): string {
  let text = full;
  for (const marker of [...QUOTE_START, ...SIGNATURE_START]) {
    const found = marker.exec(text);
    if (found) text = text.slice(0, found.index);
  }
  text = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
  // A sign-off starts the signature only after real words and before a few short lines (a name, a title):
  // "Thanks!" that opens a short reply is part of it.
  for (const found of text.matchAll(SIGN_OFF)) {
    const before = text.slice(0, found.index).trim();
    const rest = text.slice(found.index + found[0].length).split("\n").filter((line) => line.trim());
    if (before && !GREETING.test(before) && rest.length <= 4 && rest.every((line) => line.trim().length <= 60)) {
      text = text.slice(0, found.index);
      break;
    }
  }
  const own = tidy(text);
  const forward = !own || GREETING.test(own) ? FORWARD.exec(full) : null;
  if (!forward) return own;
  const lines = full.slice(forward.index + forward[0].length).replace(/^\s+/, "").split("\n");
  const head = lines.findIndex((line) => !HEADER.test(line));
  const header = lines.slice(0, head < 0 ? lines.length : head).filter((line) => /^(From|Subject): /i.test(line));
  return [tidy(header.join("\n")), newWords(head < 0 ? "" : lines.slice(head).join("\n"))].filter(Boolean).join("\n\n") || own;
}

const tidy = (text: string) =>
  text
    // Verification links and codes never reach the model.
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
