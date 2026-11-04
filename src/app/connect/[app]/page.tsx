import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { APPS, APP_NAMES, type App } from "@/lib/connect";
import { accountKey } from "@/lib/session-json";
import KeepToken from "./keep-token";

export const metadata: Metadata = { title: "Connecting · Zeno", robots: { index: false, follow: false } };

// Where an app's sign-in comes back (Nov 4, src/lib/connect.ts): /connect/<app>#token=…. The token stays in the hash,
// which never reaches a server; this browser keeps it for the signed-in account, then goes home.
export default function Connect({ params }: PageProps<"/connect/[app]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center gap-6 px-4 py-12">
      <Suspense>
        <Finish params={params} />
      </Suspense>
    </main>
  );
}

async function Finish({ params }: Pick<PageProps<"/connect/[app]">, "params">) {
  const { app } = await params;
  await connection(); // the account is read at request time (auth() draws random values, which can't be prerendered)
  const known = (APPS as readonly string[]).includes(app) ? (app as App) : null;
  const email = known ? (await auth())?.user?.email : null;
  return (
    <article className="card hello w-full">
      <div className="lines">
        <h1 className="font-bold">{known ? `Connecting ${APP_NAMES[known]}…` : "Zeno doesn't know that app."}</h1>
        {known && !email && (
          <p>
            <span className="hand">Sign in to Zeno first, then connect again.</span>
          </p>
        )}
        <p>
          <Link href="/" className="link -ml-1">
            Back to Zeno
          </Link>
        </p>
      </div>
      {known && email && <KeepToken app={known} account={accountKey(email, process.env.AUTH_SECRET ?? "")} />}
    </article>
  );
}
