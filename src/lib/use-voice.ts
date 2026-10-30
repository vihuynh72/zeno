// stub: replaced by feat/voice-core at merge
// Text-only stand-in with the real hook's exact signature: no speech input and no audio,
// so the Guided day screens run end to end by typing until voice lands.
import { useRef, useState } from "react";

export type VoicePhase = "idle" | "listening" | "thinking" | "speaking";
export type VoiceError = "blocked" | "unsupported" | "network" | null;

export function useVoice(options: {
  onUserTurn: (text: string, how: "voice" | "typed") => Promise<string | null>;
}): {
  phase: VoicePhase;
  levelRef: { current: number };
  partial: string;
  supported: boolean;
  muted: boolean;
  error: VoiceError;
  start(): void;
  speak(text: string): Promise<void>;
  submit(text: string): Promise<void>;
  interrupt(): void;
  stop(): void;
  setMuted(muted: boolean): void;
} {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [muted, setMuted] = useState(false);
  const levelRef = useRef(0);

  return {
    phase,
    levelRef,
    partial: "",
    supported: false,
    muted,
    error: null,
    start() {},
    async speak() {},
    async submit(text) {
      setPhase("thinking");
      try {
        await options.onUserTurn(text, "typed");
      } finally {
        setPhase("idle");
      }
    },
    interrupt() {
      setPhase("idle");
    },
    stop() {
      setPhase("idle");
    },
    setMuted,
  };
}
