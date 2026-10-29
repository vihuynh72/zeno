"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import type { EmailSummary } from "@/lib/gmail";

type State =
  | "loading"
  | "signed-out"
  | "reauth"
  | "no-email-access"
  | "not-enabled"
  | "error"
  | "ok";

export default function EmailCard() {
  const [state, setState] = useState<State>("loading");
  const [emails, setEmails] = useState<EmailSummary[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/email/recent")
      .then(async (response) => {
        const data = (await response.json()) as {
          state: State;
          emails: EmailSummary[];
        };
        if (!active) return;
        setState(data.state);
        setEmails(data.emails ?? []);
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = emails.filter((email) => email.unread).length;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold tracking-tight">Email that may need you</h2>
      <div className="mt-3 rounded-2xl border border-neutral-200 p-5">
        {state === "loading" && <p>Reading your recent email...</p>}
        {state === "signed-out" && (
          <p>
            Sign in with Google above and this will show your real recent inbox mail. Zeno
            reads recent messages only. It does not replace your inbox.
          </p>
        )}
        {state === "reauth" && (
          <>
            <p>Your Google connection expired.</p>
            <button
              onClick={() => signIn("google", { redirectTo: "/" })}
              className="mt-3 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
            >
              Reconnect Google
            </button>
          </>
        )}
        {state === "no-email-access" && (
          <p>
            You are signed in, but email access is missing. Sign out and sign in again so
            Google can ask for read only email permission.
          </p>
        )}
        {state === "not-enabled" && (
          <p>
            Google can see your account, but the Gmail API is not switched on for this
            project yet. In Google Cloud Console, open APIs and Services, then Library,
            search Gmail API, and press Enable. Then refresh this page.
          </p>
        )}
        {state === "error" && (
          <p>Gmail did not answer. Your calendar and goals still work. Try again later.</p>
        )}
        {state === "ok" && emails.length === 0 && (
          <p>Your inbox looks clear at the top. Nothing recent is asking for you.</p>
        )}
        {state === "ok" && emails.length > 0 && (
          <>
            <p className="text-sm text-neutral-500">
              {emails.length} recent messages, {unreadCount} unread. Read only. Zeno cannot
              send or delete mail.
            </p>
            <ul className="mt-2 divide-y divide-neutral-200">
              {emails.map((email) => (
                <li key={email.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className={email.unread ? "font-semibold" : "font-medium"}>
                      {email.subject}
                    </span>
                    {email.unread && (
                      <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-500">{email.from}</p>
                  {email.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm">{email.snippet}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
