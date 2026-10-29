"use client";

import { useEffect, useState } from "react";
import type { Brief } from "@/lib/brief";
import { speakText, stopSpeaking } from "@/lib/speak";

type Mode = "loading" | "sample" | "rule" | "ai" | "error";
type Sources = Record<"calendar" | "email" | "goals", string>;

const SOURCE_NAMES = ["calendar", "email", "goals"] as const;

const SAMPLE_BRIEF: Brief = {
  headline: "Good morning. Here is your brief.",
  body: "Start with the hardest open goal while your head is clear. Your calendar below shows what the day already holds, so pick actions that fit around it.",
  firstAction: "Pick your hardest open goal below and give it the first clear hour.",
};

export default function BriefCard() {
  const [mode, setMode] = useState<Mode>("loading");
  const [brief, setBrief] = useState<Brief>(SAMPLE_BRIEF);
  const [sources, setSources] = useState<Sources | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/brief")
      .then(async (response) => {
        const data = (await response.json()) as {
          state: string;
          brief?: Brief;
          sources?: Sources;
        };
        if (!active) return;
        if ((data.state === "ai" || data.state === "rule") && data.brief) {
          setBrief(data.brief);
          setSources(data.sources ?? null);
          setMode(data.state === "ai" ? "ai" : "rule");
        } else {
          // The sample tells the reader to sign in, so only a signed-out person gets it.
          setMode(data.state === "signed-out" ? "sample" : "error");
        }
      })
      .catch(() => {
        // Network errors and non-JSON replies, like a platform 504 page.
        if (active) setMode("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  async function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = [brief.headline, brief.body, brief.firstAction ? `Start with this one. ${brief.firstAction}` : ""]
      .filter(Boolean)
      .join(" ");
    setVoiceNote(null);
    const result = await speakText(text, (isSpeaking) => setSpeaking(isSpeaking));
    if (result === "browser") {
      setVoiceNote("Using your browser voice while the Zeno voice connects.");
    } else if (result === "unavailable") {
      setVoiceNote("Spoken brief is not available in this browser. The written brief above is complete.");
      setSpeaking(false);
    }
  }

  const badge =
    mode === "ai"
      ? "AI brief, Muse Spark"
      : mode === "rule"
        ? "From your real day"
        : "Simulated brief";

  const read = SOURCE_NAMES.filter((name) => sources?.[name] === "ok");
  const unread = SOURCE_NAMES.filter((name) => sources?.[name] !== "ok");
  const list = new Intl.ListFormat("en-US");
  const aiNote =
    (read.length ? `Written by the AI from your ${list.format(read)}.` : "Written by the AI.") +
    (unread.length ? ` It could not read your ${list.format(unread)}.` : "");
  const note =
    mode === "ai"
      ? aiNote
      : mode === "rule"
        ? "Built from your calendar and goals. The AI writer did not answer, so this plain version stands in, clearly labeled."
        : "This brief is sample text on purpose. Sign in and it is written from your real day.";

  return (
    <section className="brief-in rounded-2xl border border-neutral-200 p-6 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "loading"
            ? "Preparing your brief..."
            : mode === "error"
              ? "Your brief didn't load. Refresh to try again."
              : brief.headline}
        </h1>
        {mode !== "loading" && mode !== "error" && (
          <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium">
            {badge}
          </span>
        )}
      </div>
      {mode !== "loading" && mode !== "error" && (
        <>
          <p className="mt-3 max-w-[65ch]">{brief.body}</p>
          <p className="mt-2 text-sm text-neutral-500">{note}</p>
          <div className="mt-5">
            <h2 className="text-sm font-semibold">Start with this one</h2>
            <p className="mt-1 text-lg font-medium">
              {brief.firstAction ?? "Nothing open. Add a goal below."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={toggleSpeak}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
            >
              {speaking ? "Stop reading" : "Listen to brief"}
            </button>
            <span className="text-xs text-neutral-500">
              Zeno voice when connected, browser voice as backup.
            </span>
          </div>
          {speaking && (
            <p className="mt-2 text-sm" role="status">
              Reading your brief aloud now.
            </p>
          )}
          {voiceNote && (
            <p className="mt-2 text-sm" role="status">
              {voiceNote}
            </p>
          )}
        </>
      )}
    </section>
  );
}
