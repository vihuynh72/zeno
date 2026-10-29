"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-neutral-500">Checking sign in...</span>;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <span className="text-sm">
        {session.user?.name ?? session.user?.email ?? "Signed in"}
      </span>
      <button
        onClick={() => signOut()}
        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
      >
        Sign out
      </button>
    </span>
  );
}
