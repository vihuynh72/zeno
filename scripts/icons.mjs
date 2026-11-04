// Renders Zeno's app icons from the Z mark in the header (src/components/day-view.tsx): a white Z on ink.
// Run after changing the mark: node scripts/icons.mjs (sharp comes with Next).
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = (size, rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 34 34">` +
  `<rect width="34" height="34" rx="${rx}" fill="#1a1a1a"/>` +
  `<path d="M10 11h14l-9.5 12H24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

// Rounded like the header's tile for tabs and desktop installs; full-bleed where the system cuts its own shape (iPhone,
// and the maskable icon macOS and Android round). The Z stays inside the maskable safe zone, a circle 80% across.
const icons = [
  ["src/app/icon.png", 64, 9],
  ["src/app/apple-icon.png", 180, 0],
  ["public/icon-192.png", 192, 9],
  ["public/icon-512.png", 512, 9],
  ["public/icon-maskable.png", 1024, 0],
];

for (const [file, size, rx] of icons) {
  const image = sharp(Buffer.from(svg(size, rx)));
  // Full-bleed icons carry no alpha channel at all, so no platform reads them as shaped.
  await (rx ? image : image.removeAlpha()).png().toFile(fileURLToPath(new URL(`../${file}`, import.meta.url)));
}
