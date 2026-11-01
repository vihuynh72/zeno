export type EmailSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  unread: boolean;
  // From someone who may expect an answer, not a bulk or no-reply sender.
  personal: boolean;
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

// Gmail's Promotions, Social, Updates and Forums tabs, and no-reply senders: mail nobody answers.
const BULK = /^CATEGORY_(PROMOTIONS|SOCIAL|UPDATES|FORUMS)$/;
const NO_REPLY = /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|newsletter/i;

export async function getRecentEmail(accessToken: string): Promise<EmailSummary[]> {
  const list = (await gmailFetch(
    accessToken,
    "messages?maxResults=8&labelIds=INBOX",
  )) as GmailListResponse;

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

  return messages.map((message) => {
    const from = header(message, "From");
    const labels = message.labelIds ?? [];
    return {
      id: message.id ?? crypto.randomUUID(),
      from: from || "Unknown sender",
      subject: header(message, "Subject") || "(no subject)",
      snippet: (message.snippet ?? "").slice(0, 160),
      unread: labels.includes("UNREAD"),
      personal: Boolean(from) && !NO_REPLY.test(from) && !labels.some((label) => BULK.test(label)),
    };
  });
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

// The new words of one email, at most 1,500 characters: no quoted replies, signatures, markup, links or long numbers.
export function cleanBody(raw: string, html = false): string {
  let text = (html ? htmlToText(raw) : raw).replace(/\r\n?/g, "\n");
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
  const clean = text
    // Verification links and codes never reach the model.
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [...clean].slice(0, 1500).join("");
}
