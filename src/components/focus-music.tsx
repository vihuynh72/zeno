"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { STATIONS, TRACKS, brownNoise, playOrder, type Station } from "@/lib/music";

// Music for deep work (docs/PLAN-NOV2.md decision 13): a small "Music" link on the Focus screen shows the stations.
// The choice is remembered per browser and plays only while `active` (the Focus screen is up), never on its own.
const KEY = "zeno:music";
const TRACK_VOLUME = 0.35;
const NOISE_VOLUME = 0.4;
const OPTIONS: { id: Station | "off"; label: string }[] = [...STATIONS, { id: "off", label: "Off" }];

const subscribeNever = () => () => {};
function savedChoice(): Station | "off" {
  try {
    const value = localStorage.getItem(KEY);
    return STATIONS.some((station) => station.id === value) ? (value as Station) : "off";
  } catch {
    return "off";
  }
}

type Player = {
  audio: HTMLAudioElement | null;
  station: Station | null; // the station audio.src belongs to
  queue: string[];
  last: string | null;
  misses: number;
  context: AudioContext | null;
  buffer: AudioBuffer | null;
  noise: AudioBufferSourceNode | null;
};

export default function FocusMusic({ active }: { active: boolean }) {
  const saved = useSyncExternalStore(subscribeNever, savedChoice, () => "off" as const);
  const [chosen, setChosen] = useState<Station | "off" | null>(null);
  const choice = chosen ?? saved;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useRef<Player>({ audio: null, station: null, queue: [], last: null, misses: 0, context: null, buffer: null, noise: null });

  useEffect(() => {
    const p = player.current;
    if (!active || choice === "off") return;

    if (choice === "noise") {
      const context = (p.context ??= new AudioContext());
      void context.resume();
      if (!p.buffer) {
        const length = context.sampleRate * 10;
        p.buffer = context.createBuffer(1, length, context.sampleRate);
        p.buffer.copyToChannel(brownNoise(length, Math.round(context.sampleRate / 2)), 0);
      }
      const gain = context.createGain();
      gain.gain.value = NOISE_VOLUME;
      const source = context.createBufferSource();
      source.buffer = p.buffer;
      source.loop = true;
      source.connect(gain).connect(context.destination);
      source.start();
      p.noise = source;
      return () => {
        source.stop();
        source.disconnect();
        gain.disconnect();
        p.noise = null;
      };
    }

    const tracks = TRACKS[choice];
    const audio = (p.audio ??= new Audio());
    audio.volume = TRACK_VOLUME;
    const next = () => {
      if (p.queue.length === 0) p.queue = playOrder(tracks, p.last);
      const src = p.queue.shift() ?? tracks[0];
      p.last = src;
      p.station = choice;
      audio.src = src;
      void audio.play().catch(() => {});
    };
    // A track that will not load (archive.org down, offline) is skipped; when none load, say so once.
    const skip = () => {
      p.misses += 1;
      if (p.misses >= tracks.length) setFailed(true);
      else next();
    };
    const playing = () => {
      p.misses = 0;
      setFailed(false);
    };
    audio.addEventListener("ended", next);
    audio.addEventListener("error", skip);
    audio.addEventListener("playing", playing);
    // Back on the same station (Keep going), the paused track carries on.
    if (p.station === choice && audio.src) void audio.play().catch(() => {});
    else {
      p.queue = [];
      p.misses = 0;
      next();
    }
    return () => {
      audio.removeEventListener("ended", next);
      audio.removeEventListener("error", skip);
      audio.removeEventListener("playing", playing);
      audio.pause();
    };
  }, [active, choice]);

  // Gone with the Focus screen: the noise context closes, so nothing keeps the device's audio busy.
  useEffect(() => {
    const p = player.current;
    return () => {
      p.audio?.pause();
      void p.context?.close();
      p.context = null;
      p.buffer = null;
    };
  }, []);

  function choose(id: Station | "off") {
    setChosen(id);
    setOpen(false);
    setFailed(false);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Blocked storage: the choice lasts until the page reloads.
    }
    // Made inside the tap, so Safari lets them play.
    const p = player.current;
    if (id === "noise") void (p.context ??= new AudioContext()).resume();
    else if (id !== "off") p.audio ??= new Audio();
  }

  const label = STATIONS.find((station) => station.id === choice)?.label;
  return (
    <>
      <button type="button" className="quiet-x" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label ? `Music: ${label}` : "Music"}
      </button>
      {open && (
        <div role="group" aria-label="Music" className="flex basis-full flex-wrap items-center justify-center gap-x-6">
          {OPTIONS.map((option) => (
            <button key={option.id} type="button" className="quiet-x" aria-pressed={choice === option.id} onClick={() => choose(option.id)}>
              {option.label}
            </button>
          ))}
          <p className="basis-full text-center text-[14px] leading-5 text-ink-2">
            Free music: lo-fi by Holizna and OMF-Games, Bach by Kimiko Ishizaka, Satie from Musopen.
          </p>
        </div>
      )}
      {failed && (
        <span role="status" className="basis-full text-center text-ink-2">
          The music didn&apos;t load.
        </span>
      )}
    </>
  );
}
