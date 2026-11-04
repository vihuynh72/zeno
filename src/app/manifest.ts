import type { MetadataRoute } from "next";

// Makes Zeno installable (Chrome and Edge's Install, Safari's Add to Dock, a phone's home screen). No service worker on
// purpose: a cached shell could serve judges stale code. The icons come from scripts/icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeno",
    short_name: "Zeno",
    description: "Zeno helps you start and finish the day's goals.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#f4f3ef",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Full-bleed, for the system to cut its own shape: the macOS Dock (Safari and Chrome) and Android.
      { src: "/icon-maskable.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}
