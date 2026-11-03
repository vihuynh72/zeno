import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Zeno",
  description: "What Zeno reads, what it keeps, and how to delete it.",
};

// Plain words on purpose: this page is what Google's consent screen links to.
// Keep it true to the code: when what Zeno stores changes, change this page in the same commit.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-[680px] px-4 py-12 text-[18px] leading-[1.6] text-ink">
      <h1 className="text-[32px] font-bold leading-tight">Zeno and your data</h1>
      <p className="mt-2 text-ink-2">Updated November 2, 2026</p>

      <h2 className="mt-10 text-[22px] font-bold">What Zeno reads</h2>
      <p className="mt-3">
        When you sign in with Google and allow it, Zeno reads your Google Calendar and Gmail so it can plan
        around your real day and learn what matters to you. It reads them only to help you inside Zeno.
      </p>
      <p className="mt-3">
        If you connect Canvas, Zeno reads your assignments for the next two weeks with an access token you create. The
        token stays only in this browser: Zeno&apos;s servers use it for that one request and never save it. Zeno never
        submits or changes anything in Canvas.
      </p>

      <h2 className="mt-10 text-[22px] font-bold">What Zeno keeps</h2>
      <ul className="mt-3 list-disc pl-6">
        <li>Your goals and steps, and short facts Zeno remembers about you (like your classes, how you like to work, or a Canvas due date).</li>
        <li>You can see every remembered fact in Memory and delete any of them, any time.</li>
        <li>Zeno does not save your emails, calendar events or Canvas instructions. It reads them when it needs them.</li>
        <li>Zeno is built never to keep passwords, sign-in codes, verification links or the names of health conditions or medicines, not even on your device.</li>
      </ul>

      <h2 className="mt-10 text-[22px] font-bold">Private things stay on your device</h2>
      <p className="mt-3">
        Your overall health, sexual orientation, religion, politics, immigration status, and balances or debts are
        private. Zeno keeps them only in this browser on this device. They are sent with each conversation, opening
        and daily scan, to write that reply through Meta&apos;s model, and are never saved on Zeno&apos;s servers. If a spoken
        reply mentions one, Google&apos;s text-to-speech reads that reply. Forget removes them, and Sign out clears
        them, and your Canvas token, from this browser.
      </p>

      <h2 className="mt-10 text-[22px] font-bold">Who processes it</h2>
      <p className="mt-3">
        Zeno uses Meta&apos;s Muse models to write its replies and to understand what you share, and Google&apos;s
        text-to-speech to speak. Each request carries only what that reply needs. Zeno&apos;s data is stored in a
        Neon Postgres database, and the app runs on Vercel.
      </p>

      <h2 className="mt-10 text-[22px] font-bold">Google user data</h2>
      <p className="mt-3">
        Zeno&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{" "}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Zeno does not sell your data, show you ads, or use it to train
        AI models.
      </p>

      <h2 className="mt-10 text-[22px] font-bold">Deleting your data</h2>
      <p className="mt-3">
        Delete any memory in Zeno&apos;s Memory screen. To delete everything Zeno keeps about you, email{" "}
        <a className="underline" href="mailto:vihuynh27.work@gmail.com">vihuynh27.work@gmail.com</a> and it will be
        removed within 7 days. You can also remove Zeno&apos;s access at{" "}
        <a className="underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
      </p>
    </main>
  );
}
