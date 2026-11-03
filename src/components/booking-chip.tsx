"use client";

import { useEffect, useRef } from "react";
import type { CalendarBlock } from "@/lib/day";

// One tap books it on the Zeno calendar; nothing is written before that tap.
export type Booking = { key: string; blocks: CalendarBlock[]; label: string; state: "offer" | "busy" | "booked" | "failed" };

export default function BookingChip({
  booking,
  onBook,
  onUndo,
  big,
}: {
  booking: Booking;
  onBook(): void;
  onUndo(): void;
  big?: boolean; // the screen's one big button (an offer that answers Zeno's line)
}) {
  // The tapped button turns into Booked · Undo, so keyboard focus moves to Undo instead of falling to the page.
  const undo = useRef<HTMLButtonElement>(null);
  const was = useRef(booking.state);
  useEffect(() => {
    if (was.current === "busy" && booking.state === "booked" && document.activeElement === document.body) undo.current?.focus();
    was.current = booking.state;
  }, [booking.state]);
  if (booking.state === "booked") {
    return (
      <span className="booked" role="status">
        Booked
        <span aria-hidden="true"> · </span>
        <button ref={undo} type="button" className="quiet-x" onClick={onUndo}>
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
      className={`pill ${big ? "pill-ink pill-big" : "pill-small pill-quiet"}`}
    >
      {busy ? "Booking…" : booking.state === "failed" ? "Couldn't book. Try again?" : booking.label}
    </button>
  );
}
