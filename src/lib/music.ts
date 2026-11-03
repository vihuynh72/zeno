// Music while focusing (docs/PLAN-NOV2.md decision 13; sources and licenses in docs/MUSIC.md). Every track is CC0 or
// public domain. Lo-fi and the Satie piece ship in /public/music; the 32 Goldberg pieces stream from archive.org.
// Brown noise is made in the browser.
export type Station = "lofi" | "piano" | "noise";

export const STATIONS: { id: Station; label: string }[] = [
  { id: "lofi", label: "Lo-fi" },
  { id: "piano", label: "Piano" },
  { id: "noise", label: "Brown noise" },
];

const LOFI = ["city-in-the-rearview", "families", "opinions", "old-age", "dream-pop", "autumn", "loop"];
// Kimiko Ishizaka's Open Goldberg Variations (CC0): https://archive.org/details/The_Open_Goldberg_Variations-11823
const GOLDBERG = [
  "01_-_Aria",
  "02_-_Variatio_1_a_1_Clav",
  "03_-_Variatio_2_a_1_Clav",
  "04_-_Variatio_3_a_1_Clav_Canone_allUnisuono",
  "05_-_Variatio_4_a_1_Clav",
  "06_-_Variatio_5_a_1_ovvero_2_Clav",
  "07_-_Variatio_6_a_1_Clav_Canone_alla_Seconda",
  "08_-_Variatio_7_a_1_ovvero_2_Clav",
  "09_-_Variatio_8_a_2_Clav",
  "10_-_Variatio_9_a_1_Clav_Canone_alla_Terza",
  "11_-_Variatio_10_a_1_Clav_Fughetta",
  "12_-_Variatio_11_a_2_Clav",
  "13_-_Variatio_12_Canone_alla_Quarta",
  "14_-_Variatio_13_a_2_Clav",
  "15_-_Variatio_14_a_2_Clav",
  "16_-_Variatio_15_a_1_Clav_Canone_alla_Quinta",
  "17_-_Variatio_16_a_1_Clav_Ouverture",
  "18_-_Variatio_17_a_2_Clav",
  "19_-_Variatio_18_a_1_Clav_Canone_alla_Sexta",
  "20_-_Variatio_19_a_1_Clav",
  "21_-_Variatio_20_a_2_Clav",
  "22_-_Variatio_21_Canone_alla_Settima",
  "23_-_Variatio_22_a_1_Clav",
  "24_-_Variatio_23_a_2_Clav",
  "25_-_Variatio_24_a_1_Clav_Canone_allOttava",
  "26_-_Variatio_25_a_2_Clav",
  "27_-_Variatio_26_a_2_Clav",
  "28_-_Variatio_27_a_2_Clav_Canone_alla_Nona",
  "29_-_Variatio_28_a_2_Clav",
  "30_-_Variatio_29_a_1_ovvero_2_Clav",
  "31_-_Variatio_30_a_1_Clav_Quodlibet",
  "32_-_Aria_da_Capo__Fine",
];

export const TRACKS: Record<Exclude<Station, "noise">, string[]> = {
  lofi: LOFI.map((name) => `/music/lofi-${name}.mp3`),
  piano: [
    "/music/piano-satie-gymnopedie-1.mp3",
    ...GOLDBERG.map((name) => `https://archive.org/download/The_Open_Goldberg_Variations-11823/Kimiko_Ishizaka_-_${name}.mp3`),
  ],
};

// A play order with every track once before any repeats, never starting with the one that just played.
export function playOrder<T>(tracks: T[], last: T | null, random = Math.random): T[] {
  const order = [...tracks];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

// Brown noise (a leaky random walk) that loops without a click: its first `fade` samples are crossfaded with the
// samples that would have followed its last one.
export function brownNoise(length: number, fade: number, random = Math.random): Float32Array<ArrayBuffer> {
  const raw = new Float32Array(length + fade);
  let level = 0;
  for (let i = 0; i < raw.length; i++) {
    level = (level + 0.02 * (random() * 2 - 1)) / 1.02;
    raw[i] = level * 3.5;
  }
  const out = raw.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = raw[i] * Math.sqrt(t) + raw[length + i] * Math.sqrt(1 - t);
  }
  return out;
}
