import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listenWeb, type ListenHandlers } from "./listen";
import { playbackLevel, speakText, stopSpeaking, unlockAudio } from "./speak";
import { soundsFinished } from "./turn";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";
export type VoiceError = "blocked" | "unsupported" | "network" | null;

type Listen = typeof listenWeb;
type UserTurn = (text: string, how: "voice" | "typed") => Promise<string | null>;
// Whether to listen after Zeno says this line, for every turn and for speak(); without it, only a spoken turn does.
type ListenAfter = (said: string) => boolean;

const LISTEN_LIMIT_MS = 30_000;
// How long a pause after the last words ends the turn: short when they sound finished, long when they trail off.
const FINISHED_WAIT_MS = 700;
const UNFINISHED_WAIT_MS = 2_200;
const subscribeNever = () => () => {};

// Sound on or off is remembered per browser, so muting at night outlasts a reload; blocked storage means sound on.
const SOUND_KEY = "zeno:sound";
function soundOff() {
  try {
    return localStorage.getItem(SOUND_KEY) === "off";
  } catch {
    return false;
  }
}

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
// onSilence: a listen ended without hearing anything (no speech, an empty result, or the time limit with no words).
export function useVoice(options: { onUserTurn: UserTurn; listenAfter?: ListenAfter; onSilence?: () => void }, adapter?: { listen?: Listen }) {
  const listen = adapter?.listen ?? listenWeb;
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [partial, setPartial] = useState("");
  // The saved choice from the first render after hydration on, the one that first shows the Sound button.
  const mutedSaved = useSyncExternalStore(subscribeNever, soundOff, () => false);
  const [mutedSet, setMutedState] = useState<boolean | null>(null);
  const muted = mutedSet ?? mutedSaved;
  const [error, setError] = useState<VoiceError>(null);
  const levelRef = useRef(0);
  const latest = useRef({ ...options, listen });
  useEffect(() => {
    latest.current = { ...options, listen };
  });
  const supported = useSyncExternalStore(subscribeNever, () => canListen(listen), () => false);

  // Made once, so the methods keep their identity and a long async turn reads live values.
  const [voice] = useState(() => {
    let gen = 0; // bumped by every user action, so a stale async step stops where it is
    let current: VoicePhase = "idle";
    let quietSet: boolean | null = null; // muted this visit; until then, the saved choice
    const quiet = () => quietSet ?? soundOff();
    let session: Awaited<ReturnType<Listen>> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined; // the listen limit
    let wait: ReturnType<typeof setTimeout> | undefined; // the pause after the last words that ends the turn
    let heard = ""; // the turn's final words so far, across the pauses in it
    let live = ""; // words still being said
    const said = () => `${heard} ${live}`.trim();

    function go(next: VoicePhase) {
      current = next;
      setPhase(next);
      setPartial("");
    }

    function halt() {
      gen++;
      clearTimeout(timer);
      clearTimeout(wait);
      heard = live = "";
      session?.stop();
      session = null;
      stopSpeaking();
    }

    function stop() {
      halt();
      go("idle");
    }

    function silent() {
      stop();
      latest.current.onSilence?.();
    }

    // Everything heard goes as one turn, then the session pauses as between any two turns.
    function send() {
      const text = said();
      clearTimeout(timer);
      clearTimeout(wait);
      heard = live = "";
      if (!text) return silent();
      session?.pause();
      void turn(text, "voice");
    }

    function waitForMore() {
      clearTimeout(wait);
      wait = setTimeout(send, soundsFinished(said()) ? FINISHED_WAIT_MS : UNFINISHED_WAIT_MS);
    }

    async function listenNow() {
      const mine = gen;
      go("listening");
      setError(null);
      timer = setTimeout(send, LISTEN_LIMIT_MS);
      // Between turns the session is only paused, so an adapter can keep its connection open.
      if (session) return session.resume();
      const listening = () => mine === gen && current === "listening";
      // New speech holds the turn open until its final, which waits again.
      const handlers: ListenHandlers = {
        onSpeechStart() {
          if (listening()) clearTimeout(wait);
        },
        onPartial(text) {
          if (!listening()) return;
          clearTimeout(wait);
          live = text.trim();
          setPartial(said());
        },
        // Speech with no words gets no final, so its end starts the wait again.
        onSpeechEnd() {
          if (listening() && heard) waitForMore();
        },
        onFinal(text) {
          if (!listening()) return;
          heard = `${heard} ${text.trim()}`.trim();
          live = "";
          if (!heard) return silent();
          setPartial(heard);
          waitForMore();
        },
        onError(reason) {
          if (!listening()) return;
          if (reason === "no-speech") return silent();
          stop();
          setError(reason);
        },
      };
      try {
        const opened = await latest.current.listen(handlers, { levelRef });
        if (listening()) session = opened;
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
      if (reply && !quiet()) {
        go("speaking");
        await say(reply);
        if (mine !== gen) return;
        if (thenListen && !quiet() && canListen(latest.current.listen)) return listenNow();
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
      const { listenAfter } = latest.current;
      if (mine === gen) await answer(reply, listenAfter ? Boolean(reply && listenAfter(reply)) : how === "voice");
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
      // Done talking: what was heard goes at once; false when nothing was, so the caller stops instead.
      finish() {
        if (current !== "listening" || !said()) return false;
        send();
        return true;
      },
      async speak(text: string) {
        halt();
        unlockAudio();
        await answer(text, latest.current.listenAfter?.(text) ?? true);
      },
      async submit(text: string) {
        if (!text.trim()) return;
        halt();
        unlockAudio();
        await turn(text.trim(), "typed");
      },
      setMuted(next: boolean) {
        quietSet = next;
        setMutedState(next);
        try {
          localStorage.setItem(SOUND_KEY, next ? "off" : "on");
        } catch {
          // Blocked storage: the choice lasts until the page reloads.
        }
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
