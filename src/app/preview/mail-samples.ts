// A made-up email for the /preview gallery. Importing this answers the browser's GET /api/mail/[id] itself, so the
// gallery never reads a real inbox, even when the browser is signed in. "sample-gone" answers as Gmail's 404 would.
import type { MailResponse } from "@/lib/day";

const SAMPLE: MailResponse = {
  state: "ok",
  from: "Prof. Lin <lin@school.example>",
  address: "lin@school.example",
  subject: "Office hours this week?",
  date: "2026-11-03T16:12:00.000Z",
  text: [
    "Hi Sam,",
    "Thanks for the draft of your lab report. The methods section reads well. Before you submit, could you come by office hours so we can talk about the error bars in figure 2?",
    "Does Wednesday at 2 or Thursday at 11 work for you? If neither does, send me two times that do.",
    "Best,\nProf. Lin",
  ].join("\n\n"),
};

if (typeof window !== "undefined") {
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (!url.pathname.startsWith("/api/mail/")) return real(input, init);
    const gone = url.pathname.endsWith("/sample-gone");
    const body: MailResponse = gone ? { state: "not-found" } : SAMPLE;
    return new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json(body, { status: gone ? 404 : 200 })), 400));
  };
}
