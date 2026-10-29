import WebSocket from "ws";

const META_ASR_URL = "wss://api.meta.ai/v1/asr/realtime";

// shortcut: sessions rotate every 290 s (Hobby functions stop at 300 s) and words spoken during the ~1 s reconnect are lost; raise with maxDuration on Pro.
const SESSION_MS = 290_000;
const SESSION_END_CODE = 4000;

export function cleanKeywords(raw: string[]): string[] {
  return raw
    .map((word) => word.trim())
    .filter((word) => /^[\p{L}\p{N}' -]{1,24}$/u.test(word))
    .slice(0, 10);
}

// Pass on only the fields the browser reads. Upstream errors are dropped so nothing they echo can leak.
export function toClientEvent(text: string): string | null {
  try {
    const { type, transcript, final } = JSON.parse(text);
    return type === "error" ? null : JSON.stringify({ type, transcript, final });
  } catch {
    return null;
  }
}

export function relayToMeta(client: WebSocket, apiKey: string, keywords: string[]) {
  const upstream = new WebSocket(META_ASR_URL);
  const timer = setTimeout(() => closeBoth(SESSION_END_CODE), SESSION_MS);

  function closeBoth(code: number) {
    clearTimeout(timer);
    client.close(code);
    upstream.close(1000);
  }

  upstream.on("open", () =>
    upstream.send(
      JSON.stringify({
        authorization: { accessToken: `Bearer ${apiKey}` },
        model: "muse-voice-transcribe-1.0",
        audioEncoding: "PCM_16KHZ",
        mode: "ENDPOINTING",
        partialMode: "CUMULATIVE",
        emitAudioProgress: false,
        keywords,
      }),
    ),
  );
  upstream.on("message", (data, isBinary) => {
    const event = isBinary ? null : toClientEvent(data.toString());
    if (event) client.send(event);
  });
  client.on("message", (data, isBinary) => {
    if (isBinary && upstream.readyState === WebSocket.OPEN) upstream.send(data);
  });
  upstream.on("close", (code) => {
    if (code !== 1000) console.error("Meta speech recognition closed with code", code);
    closeBoth(code === 1000 ? 1000 : 1011);
  });
  client.on("close", () => closeBoth(1000));
  upstream.on("error", () => closeBoth(1011));
  client.on("error", () => closeBoth(1011));
}
