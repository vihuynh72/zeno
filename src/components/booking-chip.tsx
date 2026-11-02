"use client";

import type { CalendarBlock } from "@/lib/day";

// One tap books it on the Zeno calendar; nothing is written before that tap. A batch (pasted to-dos) is one chip.
export type Booking = { key: string; blocks: CalendarBlock[]; label: string; state: "offer" | "busy" | "booked" | "failed" };

export default function BookingChip({
  booking,
  onBook,
  onUndo,
  ink,
}: {
  booking: Booking;
  onBook(): void;
  onUndo(): void;
  ink?: boolean; // the screen's one main answer (Stop for now, pasted notes)
}) {
  if (booking.state === "booked") {
    return (
      <span className="booked" role="status">
        Booked
        <span aria-hidden="true"> · </span>
        <button type="button" className="quiet-x" onClick={onUndo}>
          Undo<span className="sr-only"> booking: {booking.blocks[0]?.title}</span>
        </button>
      </span>
    );
  }
  const busy = booking.state === "busy";
  return (
    <button
      type="button"
      // aria-disabled, not disabled, so focus stays put; the parent also ignores a second tap while it books.
      aria-disabled={busy}
      onClick={() => !busy && onBook()}
      className={`pill pill-small ${ink ? "pill-ink" : "pill-quiet"}`}
    >
      {busy ? "Booking…" : booking.state === "failed" ? "Couldn't book. Try again?" : booking.label}
    </button>
  );
}
