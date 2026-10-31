import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listenWeb, type ListenHandlers } from "./listen";
import { playbackLevel, speakText, stopSpeaking, unlockAudio } from "./speak";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";
export type VoiceError = "blocked" | "unsupported" | "network" | null;

type Listen = typeof listenWeb;
type UserTurn = (text: string, how: "voice" | "typed") => Promise<string | null>;

const LISTEN_LIMIT_MS = 30_000;
const subscribeNever = () => () => {};

function canListen(listen: Listen) {
  if (listen !== listenWeb) return Boolean(navigator.mediaDevices);
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

// Resolves when Zeno has said the text, or was stopped.
function say(text: string) {
  return new Promise<void>((resolve) => {
    void speakText(text, (speaking) => {
      if (!speaking) resolve();
    });
  });
}

// Half duplex: the mic is released before Zeno speaks and opened again only after.
export function useVoice(options: { onUserTurn: UserTurn }, adapter?: { listen?: Listen }) {
  const listen = adapter?.listen ?? listenWeb;
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [partial, setPartial] = useState("");
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState<VoiceError>(null);
  const levelRef = useRef(0);
  const latest = useRef({ onUserTurn: options.onUserTurn, listen });
  useEffect(() => {
    latest.current = { onUserTurn: options.onUserTurn, listen };
  });
  const supported = useSyncExternalStore(subscribeNever, () => canListen(listen), () => false);

  // Made once, so the methods keep their identity and a long async turn reads live values.
  const [voice] = useState(() => {
    let gen = 0; // bumped by every user action, so a stale async step stops where it is
    let current: VoicePhase = "idle";
    let quiet = false;
    let session: Awaited<ReturnType<Listen>> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function go(next: VoicePhase) {
      current = next;
      setPhase(next);
      setPartial("");
    }

    function halt() {
      gen++;
      clearTimeout(timer);
      session?.stop();
      session = null;
      stopSpeaking();
    }

    function stop() {
      halt();
      go("idle");
    }

    async function listenNow() {
      const mine = gen;
      go("listening");
      setError(null);
      timer = setTimeout(stop, LISTEN_LIMIT_MS);
      // Between turns the session is only paused, so an adapter can keep its connection open.
      if (session) return session.resume();
      const handlers: ListenHandlers = {
        onPartial(text) {
          if (mine === gen && current === "listening") setPartial(text);
        },
        onFinal(text) {
          if (mine !== gen || current !== "listening") return;
          clearTimeout(timer);
          session?.pause();
          if (text.trim()) void turn(text.trim(), "voice");
          else stop();
        },
        onError(reason) {
          if (mine !== gen || current !== "listening") return;
          stop();
          if (reason !== "no-speech") setError(reason);
        },
      };
      try {
        const opened = await latest.current.listen(handlers, { levelRef });
        if (mine === gen && current === "listening") session = opened;
        else opened.stop();
      } catch {
        if (mine !== gen) return;
        stop();
        setError("network");
      }
    }

    // Says the reply, then hands the mic back if the person was talking rather than typing.
    async function answer(reply: string | null, thenListen: boolean) {
      const mine = gen;
      if (reply && !quiet) {
        go("speaking");
        await say(reply);
        if (mine !== gen) return;
        if (thenListen && !quiet && canListen(latest.current.listen)) return listenNow();
      }
      stop();
    }

    async function turn(text: string, how: "voice" | "typed") {
      const mine = gen;
      go("thinking");
      let reply: string | null = null;
      try {
        reply = await latest.current.onUserTurn(text, how);
      } catch {
        // The UI shows its own message for a failed turn; Zeno just stays quiet.
      }
      if (mine === gen) await answer(reply, how === "voice");
    }

    // Called from a click or key press, so unlockAudio() still runs inside the gesture.
    function start() {
      halt();
      unlockAudio();
      void listenNow();
    }

    return {
      start,
      interrupt: start,
      stop,
      async speak(text: string) {
        halt();
        unlockAudio();
        await answer(text, true);
      },
      async submit(text: string) {
        if (!text.trim()) return;
        halt();
        unlockAudio();
        await turn(text.trim(), "typed");
      },
      setMuted(next: boolean) {
        quiet = next;
        setMutedState(next);
        if (next && current === "speaking") stopSpeaking();
      },
    };
  });

  useEffect(() => voice.stop, [voice]);

  // While Zeno talks, Esc hands the turn back and levelRef follows the playback.
  useEffect(() => {
    if (phase !== "speaking") return;
    const onKey = (event: KeyboardEvent) => {
      // An Esc that a text box or an open sheet handles is not a barge-in.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open], textarea:focus, input:focus")) return;
      voice.interrupt();
    };
    let frame = 0;
    const tick = () => {
      levelRef.current += (playbackLevel() - levelRef.current) * 0.3;
      frame = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      levelRef.current = 0;
    };
  }, [phase, voice]);

  return { phase, levelRef, partial, supported, muted, error, ...voice };
}
