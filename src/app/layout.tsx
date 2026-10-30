import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Next has no metrics to size-adjust a fallback for these families, so name plain ones.
const sans = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

const mono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Zeno",
  description: "Zeno helps you start and finish the day's goals.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#151514" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <head>
        {/* Servers run in UTC, so API routes read the person's time zone from this cookie. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.cookie="tz="+encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)+"; path=/; max-age=31536000; SameSite=Lax"`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
