// Self-check for the Meta speech relay helpers and the 16 kHz worklet. Run: node scripts/listen-check.mjs
import assert from "node:assert/strict";
import { cleanKeywords, toClientEvent } from "../src/lib/listen-relay.ts";
import { PCM_WORKLET } from "../src/lib/listen-meta.ts";

assert.deepEqual(
  cleanKeywords([" Zeno ", "Muse Spark", "", "<b>x</b>", "x".repeat(25), ...Array(12).fill("go")]),
  ["Zeno", "Muse Spark", ...Array(8).fill("go")],
);

assert.equal(toClientEvent('{"sessionId":"s1"}'), "{}");
assert.equal(
  toClientEvent('{"type":"speechComplete","turnId":1,"transcript":"hi","audioProcessedMs":9}'),
  '{"type":"speechComplete","transcript":"hi"}',
);
assert.equal(toClientEvent('{"type":"transcript","transcript":"h","final":false}'), '{"type":"transcript","transcript":"h","final":false}');
assert.equal(toClientEvent('{"type":"error","message":"bad key"}'), null);
assert.equal(toClientEvent("not json"), null);
assert.equal(toClientEvent("null"), null);

// One second of a 440 Hz tone at any context rate must become 50 frames of 320 samples at the same loudness.
for (const rate of [48000, 44100, 24000, 16000, 8000]) {
  const frames = [];
  let Processor;
  class AudioWorkletProcessor {
    port = { postMessage: (buffer) => frames.push(new Int16Array(buffer)) };
  }
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", PCM_WORKLET)(
    AudioWorkletProcessor,
    (_name, cls) => (Processor = cls),
    rate,
  );
  const processor = new Processor();
  assert.equal(processor.process([[]]), true);
  for (let start = 0; start < rate; start += 128) {
    const block = Float32Array.from({ length: 128 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * (start + i)) / rate));
    processor.process([[block]]);
  }
  assert.equal(frames.length, 50, `${rate} Hz frame count`);
  assert.ok(frames.every((frame) => frame.length === 320));
  const samples = frames.flatMap((frame) => [...frame]);
  const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
  assert.ok(Math.abs(rms / (0.5 * 32767 * Math.SQRT1_2) - 1) < 0.03, `${rate} Hz loudness ${rms}`);
}

console.log("listen-check: ok");
