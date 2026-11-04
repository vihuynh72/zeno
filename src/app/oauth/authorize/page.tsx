import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { auth, signIn } from "@/auth";
import { askOf, consentCheck } from "@/lib/oauth";

export const metadata: Metadata = { title: "Connect · Zeno", robots: { index: false, follow: false } };

// Zeno's sign-in for Claude, ChatGPT and other MCP clients (src/lib/oauth.ts): one card asking to let the app in. Signed
// out, Google sign-in comes back to this same address.
export default function Authorize({ searchParams }: PageProps<"/oauth/authorize">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center gap-6 px-4 py-12">
      <Suspense>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card hello w-full">
      <div className="lines">
        <h1 className="font-bold">{title}</h1>
        {children}
      </div>
    </article>
  );
}

const Hand = ({ children }: { children: ReactNode }) => (
  <p>
    <span className="hand">{children}</span>
  </p>
);

async function Consent({ searchParams }: Pick<PageProps<"/oauth/authorize">, "searchParams">) {
  const params = await searchParams;
  const ask = await askOf(params);
  if (typeof ask === "string") {
    return (
      <Card title="This link to Zeno isn't valid.">
        <Hand>Go back to the app and connect again.</Hand>
      </Card>
    );
  }
  const name = ask.client.client_name ?? "This app";
  const email = (await auth())?.user?.email;

  if (!email) {
    const back = `/oauth/authorize?${new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`;
    return (
      <>
        <Card title={`Let ${name} use Zeno?`}>
          <Hand>Sign in to Zeno first.</Hand>
        </Card>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: back });
          }}
        >
          <button className="pill pill-ink pill-big">Sign in with Google</button>
        </form>
      </>
    );
  }

  const hidden = {
    response_type: "code",
    client_id: ask.client.client_id,
    redirect_uri: ask.redirectUri,
    code_challenge: ask.challenge,
    code_challenge_method: "S256",
    ...(ask.state !== null && { state: ask.state }),
    check: consentCheck(email, ask),
  };
  return (
    <>
      <Card title={`Let ${name} use Zeno?`}>
        <Hand>See your goals and steps</Hand>
        <Hand>Add goals</Hand>
        <Hand>Mark steps done</Hand>
      </Card>
      <form method="post" action="/api/oauth/authorize" className="flex flex-col items-center gap-2">
        {Object.entries(hidden).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button name="decision" value="allow" className="pill pill-ink pill-big">
          Allow
        </button>
        <button name="decision" value="cancel" className="link">
          Cancel
        </button>
      </form>
      <p className="text-center text-ink-2">
        Never your mail, calendar or what Zeno remembers.
        <br />
        Signed in as {email}. You&apos;ll go back to {new URL(ask.redirectUri).host}.
      </p>
    </>
  );
}
