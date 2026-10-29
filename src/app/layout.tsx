import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Providers from "@/components/providers";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zeno",
  description: "Zeno helps you start and finish the day's goals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <head>
        {/* Servers run in UTC, so API routes read the person's time zone from this cookie. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.cookie="tz="+encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)+"; path=/; max-age=31536000; SameSite=Lax"`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
