export type ListenHandlers = {
  onSpeechStart?: () => void;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  // Errors are final (mic and socket already released). "no-speech" never fires: silence just keeps listening.
  onError?: (reason: "blocked" | "unsupported" | "network" | "no-speech") => void;
};

// Audio thread: averages mic samples down to 16 kHz 16-bit PCM and posts 20 ms frames.
export const PCM_WORKLET = `registerProcessor("pcm16k", class extends AudioWorkletProcessor {
  step = sampleRate / 16000; pos = 0; sum = 0; count = 0; frame = new Int16Array(320); length = 0;
  process([[input]]) {
    for (const sample of input ?? []) {
      this.sum += sample; this.count++; this.pos++;
      if (this.pos < this.step) continue;
      const value = Math.max(-1, Math.min(1, this.sum / this.count)) * 0x7fff;
      this.sum = this.count = 0;
      for (; this.pos >= this.step; this.pos -= this.step) {
        this.frame[this.length++] = value;
        if (this.length < 320) continue;
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Int16Array(320); this.length = 0;
      }
    }
    return true;
  }
});`;

// An open session streams about 32 KB/s even while silent, so a forgotten tab must not keep one alive.
const IDLE_STOP_MS = 120_000;

export async function listenMeta(
  handlers: ListenHandlers,
  opts?: { keywords?: string[]; levelRef?: { current: number } },
): Promise<{ stop: () => void; pause: () => void; resume: () => void }> {
  let stream: MediaStream | undefined;
  let audio: AudioContext | undefined;
  let node: AudioWorkletNode;
  try {
    // Created before the first await so Safari still counts it as part of the tap.
    audio = new AudioContext();
    void audio.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const moduleUrl = URL.createObjectURL(new Blob([PCM_WORKLET], { type: "text/javascript" }));
    await audio.audioWorklet.addModule(moduleUrl);
    URL.revokeObjectURL(moduleUrl);
    node = new AudioWorkletNode(audio, "pcm16k");
    audio.createMediaStreamSource(stream).connect(node).connect(audio.destination);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    void audio?.close();
    const name = (error as Error).name;
    handlers.onError?.(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "unsupported");
    return { stop() {}, pause() {}, resume() {} };
  }

  const query = new URLSearchParams((opts?.keywords ?? []).map((word) => ["k", word]));
  const endpoint = `${location.origin.replace("http", "ws")}/api/listen?${query}`;
  let socket: WebSocket;
  let ready = false;
  let paused = false;
  let stopped = false;
  let markReady = () => {};
  const firstReady = new Promise<void>((resolve) => (markReady = resolve));
  let lastSpeech = Date.now();
  const idle = setInterval(() => {
    if (Date.now() - lastSpeech > IDLE_STOP_MS) quit("no-speech");
  }, 5_000);
  const onHidden = () => document.hidden && quit("no-speech");
  document.addEventListener("visibilitychange", onHidden);

  function connect() {
    const ws = new WebSocket(endpoint);
    socket = ws;
    ready = false;
    setTimeout(() => {
      if (socket === ws && !ready) fail();
    }, 10_000);
    ws.onmessage = ({ data }) => {
      const event = JSON.parse(data) as { type?: string; transcript?: string; final?: boolean };
      const text = event.transcript?.trim();
      // Meta lags the audio by about half a second; anything after pause() is stale or Zeno's own voice.
      if (paused && event.type) return;
      if (!event.type) {
        ready = true;
        markReady();
      } else if (event.type === "speechStart") {
        lastSpeech = Date.now();
        handlers.onSpeechStart?.();
      }
      else if (event.type === "transcript" && !event.final && text) handlers.onPartial?.(text);
      else if (event.type === "speechComplete" && text) handlers.onFinal(text);
    };
    ws.onclose = ({ code }) => {
      if (socket !== ws) return;
      // 4000 is the relay's planned rotation just before the function time limit.
      if (code === 4000 && !stopped) connect();
      else fail();
    };
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(idle);
    document.removeEventListener("visibilitychange", onHidden);
    if (opts?.levelRef) opts.levelRef.current = 0;
    socket.close();
    stream?.getTracks().forEach((track) => track.stop());
    void audio?.close();
  }

  function quit(reason: "network" | "no-speech") {
    if (stopped) return;
    stop();
    markReady();
    handlers.onError?.(reason);
  }

  function fail() {
    quit("network");
  }

  node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
    if (opts?.levelRef) {
      const samples = new Int16Array(data);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = paused ? 0 : Math.min(1, (Math.sqrt(sum / samples.length) / 0x7fff) * 4);
      opts.levelRef.current = opts.levelRef.current * 0.6 + rms * 0.4;
    }
    if (ready && socket.readyState === WebSocket.OPEN) {
      socket.send(paused ? new ArrayBuffer(data.byteLength) : data);
    }
  };
  connect();
  await firstReady;
  return {
    stop,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}
