import { notFound } from "next/navigation";
import { Suspense } from "react";
import Gallery from "./gallery";

// Dev-only gallery of every Guided day state with sample data, for screenshots:
// /preview?state=brief&theme=dark (no state lists them all).
export default function PreviewPage({ searchParams }: PageProps<"/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/preview">, "searchParams">) {
  const { state, theme } = await searchParams;
  return (
    <Gallery
      state={typeof state === "string" ? state : ""}
      theme={theme === "light" || theme === "dark" ? theme : undefined}
    />
  );
}
