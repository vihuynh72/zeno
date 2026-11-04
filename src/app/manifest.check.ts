// Self-check for the install manifest and the icons from scripts/icons.mjs: node src/app/manifest.check.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const { default: manifest } = await import("./manifest.ts");
const app = manifest();

// A PNG's size and whether it has an alpha channel, from its IHDR header.
const png = (path: string) => {
  const bytes = readFileSync(new URL(path, root));
  assert.equal(bytes.toString("latin1", 12, 16), "IHDR", `${path} is a PNG`);
  return { size: `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, alpha: bytes[25] === 4 || bytes[25] === 6 };
};

assert.equal(app.name, "Zeno");
assert.equal(app.start_url, "/");
assert.equal(app.display, "standalone");
assert.ok(readFileSync(new URL("src/app/layout.tsx", root), "utf8").includes(`description: "${app.description}"`), "layout's description");

// Every icon is the size it says. Chrome installs only with 192 and 512 icons for any use; a maskable icon is opaque.
const icons = app.icons ?? [];
for (const icon of icons) {
  const file = png(`public${icon.src}`);
  assert.equal(file.size, icon.sizes, icon.src);
  if (icon.purpose === "maskable") assert.equal(file.alpha, false, `${icon.src} is opaque`);
}
const anySizes = icons.filter((icon) => (icon.purpose ?? "any") === "any").map((icon) => icon.sizes);
assert.deepEqual(anySizes, ["192x192", "512x512"]);
assert.ok(icons.some((icon) => icon.purpose === "maskable"));

// The tab icon is the rounded tile; the iPhone's is a full square (iOS paints transparent corners black).
assert.equal(png("src/app/icon.png").alpha, true);
assert.deepEqual(png("src/app/apple-icon.png"), { size: "180x180", alpha: false });
assert.equal(existsSync(new URL("src/app/favicon.ico", root)), false, "Next's default favicon stays gone");

console.log("manifest ok");
