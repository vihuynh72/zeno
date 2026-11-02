"use client";

// Quiet lines under the card: what Zeno just noted or kept on this device (each with Undo), and heads-ups.
// until: when the line stops being true (a heads-up's event start), in ms.
export type Quiet = { key: string; text: string; undo?: () => void; until?: number };

export default function NotedLines({ lines }: { lines: Quiet[] }) {
  return (
    <ul aria-live="polite" className="noted mt-2 flex w-full max-w-[640px] flex-col items-center text-center text-ink-2 empty:mt-0">
      {lines.map((line) => (
        <li key={line.key}>
          {line.text}
          {line.undo && (
            <>
              <span aria-hidden="true"> · </span>
              <button type="button" className="quiet-x" onClick={line.undo}>
                Undo<span className="sr-only">: {line.text}</span>
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
