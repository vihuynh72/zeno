export type SpeakResult = "server" | "browser" | "unavailable";

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

export async function speakText(
  text: string,
  onState?: (speaking: boolean, source: SpeakResult | null) => void,
): Promise<SpeakResult> {
  stopSpeaking();
  onState?.(true, null);

  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) {
      const data = (await response.json()) as { audioContent?: string };
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          onState?.(false, "server");
        };
        audio.onerror = () => {
          currentAudio = null;
          onState?.(false, "server");
        };
        await audio.play();
        return "server";
      }
    }
  } catch {
    // Fall through to the browser voice below.
  }

  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
    utterance.rate = 1;
    utterance.onend = () => onState?.(false, "browser");
    utterance.onerror = () => onState?.(false, "browser");
    window.speechSynthesis.speak(utterance);
    return "browser";
  }

  onState?.(false, null);
  return "unavailable";
}
