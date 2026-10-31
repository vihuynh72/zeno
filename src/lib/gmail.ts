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

type GmailMessage = {
  id?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
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
