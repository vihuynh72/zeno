"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speakText, stopSpeaking } from "@/lib/speak";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type VoiceState = "checking" | "ready" | "listening" | "blocked" | "unsupported";

type Exchange = {
  id: string;
  user: string;
  reply: string | null;
  state: "thinking" | "ok" | "signed-out" | "no-key" | "model-error" | "error";
};

const SUGGESTIONS = [
  "What should I do first?",
  "Plan my free time today",
  "Which email needs me most?",
];

export default function TalkSection() {
  const [message, setMessage] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [sending, setSending] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const browserSupported = useSyncExternalStore(
    () => () => {},
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    () => false,
  );
  const [voiceOverride, setVoiceOverride] = useState<VoiceState | null>(null);
  const voice: VoiceState =
    voiceOverride ?? (browserSupported ? "ready" : "unsupported");
  const setVoice = (next: VoiceState) => setVoiceOverride(next);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startVoice() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setVoice("unsupported");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    baseTextRef.current = message ? `${message.trim()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setMessage(baseTextRef.current + transcript);
    };
    recognition.onerror = (event) => {
      setVoice(event.error === "not-allowed" ? "blocked" : "ready");
    };
    recognition.onend = () => {
      setVoiceOverride((current) => (current === "listening" ? "ready" : current));
    };
    recognitionRef.current = recognition;
    setVoice("listening");
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setVoice("ready");
  }

  async function send() {
    const text = message.trim();
    if (!text || sending) return;
    if (voice === "listening") stopVoice();
    setMessage("");
    setSending(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Last 6 answered exchanges, oldest first. Exchanges are stored newest first.
    const history = exchanges
      .filter((item) => item.state === "ok" && item.reply)
      .slice(0, 6)
      .reverse()
      .flatMap((item) => [
        { role: "user", content: item.user },
        { role: "assistant", content: item.reply },
      ]);
    setExchanges((prev) => [{ id, user: text, reply: null, state: "thinking" }, ...prev]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = (await response.json().catch(() => ({ state: "error" }))) as {
        state: Exchange["state"];
        reply?: string;
      };
      setExchanges((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, reply: data.reply ?? null, state: data.state } : item,
        ),
      );
    } catch {
      setExchanges((prev) =>
        prev.map((item) => (item.id === id ? { ...item, state: "error" } : item)),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Talk to Zeno</h2>
        <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium">
          Voice uses your browser microphone
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Ask anything about your day. Zeno sees your calendar, goals, and recent email, and
        answers like a chief of staff, short and concrete. Press Speak to talk instead of
        typing.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setMessage(suggestion)}
            className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && send()}
          placeholder={
            voice === "listening"
              ? "Listening. Speak now."
              : "Ask Zeno, or say what you want to get done"
          }
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
          aria-label="Message to Zeno"
        />
        {voice === "listening" ? (
          <button
            onClick={stopVoice}
            className="shrink-0 rounded-xl border border-black bg-white px-5 py-3 font-semibold text-black transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
          >
            <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-black align-middle" />
            Stop
          </button>
        ) : (
          <button
            onClick={startVoice}
            disabled={voice === "unsupported" || voice === "checking"}
            className="shrink-0 rounded-xl border border-neutral-300 px-5 py-3 font-semibold transition enabled:hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Speak
          </button>
        )}
        <button
          onClick={send}
          disabled={sending}
          className="shrink-0 rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Thinking..." : "Send"}
        </button>
      </div>
      {voice === "listening" && (
        <p className="mt-2 text-sm" role="status">
          Listening now. Speak, check the words, then press Send.
        </p>
      )}
      {voice === "blocked" && (
        <p className="mt-2 text-sm" role="status">
          The microphone is blocked for this site. Allow microphone access in your browser
          settings, or keep typing. Typing works fully.
        </p>
      )}
      {voice === "unsupported" && (
        <p className="mt-2 text-sm text-neutral-500" role="status">
          Voice input is not available in this browser. Chrome supports it. Typing works
          fully here.
        </p>
      )}
      {exchanges.length > 0 && (
        <ul className="mt-5 space-y-4">
          {exchanges.map((exchange) => (
            <li key={exchange.id}>
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-black px-4 py-2.5 text-white">
                  {exchange.user}
                </p>
              </div>
              <div className="mt-2 flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-4 py-3">
                  {exchange.state === "thinking" && (
                    <p className="text-sm text-neutral-500" role="status">
                      Zeno is thinking...
                    </p>
                  )}
                  {exchange.state === "ok" && exchange.reply && (
                    <>
                      <p className="whitespace-pre-wrap">{exchange.reply}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <button
                          onClick={async () => {
                            if (speakingId === exchange.id) {
                              stopSpeaking();
                              setSpeakingId(null);
                              return;
                            }
                            setSpeakingId(exchange.id);
                            await speakText(exchange.reply ?? "", (isSpeaking) => {
                              if (!isSpeaking) setSpeakingId(null);
                            });
                          }}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          {speakingId === exchange.id ? "Stop" : "Listen"}
                        </button>
                        <span className="text-xs text-neutral-500">
                          Muse Spark, with your day in view
                        </span>
                      </div>
                    </>
                  )}
                  {exchange.state === "signed-out" && (
                    <p className="text-sm">
                      Sign in with Google above, then Zeno can answer with your real day in view.
                    </p>
                  )}
                  {exchange.state === "no-key" && (
                    <p className="text-sm">
                      The AI key is not connected on the server yet, so no reply was made. Your
                      words were not sent anywhere.
                    </p>
                  )}
                  {(exchange.state === "model-error" || exchange.state === "error") && (
                    <p className="text-sm">
                      Zeno could not reach the AI just now. Your calendar and goals still work.
                      Try again in a moment.
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
