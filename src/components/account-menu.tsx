"use client";

import { useEffect, useRef, useState } from "react";
import AppsSheet from "@/components/apps-sheet";

// The person's initial in the top bar opens Memory, Sound, Canvas, Connect an app, Privacy and Sign out. canvas is null
// until the page knows whose account it is (the link is kept per account), true once Canvas is linked on this device.
// onCalendar is set only when they unticked calendar access on Google's consent screen, so a block they ask for has a
// way through. Connect an app opens its own sheet (apps-sheet.tsx).
export default function AccountMenu({
  initial,
  muted,
  canvas,
  onMemory,
  onMute,
  onCanvas,
  onCalendar,
  onSignOut,
  open,
}: {
  initial: string;
  muted: boolean;
  canvas: boolean | null;
  onMemory(): void;
  onMute(): void;
  onCanvas(): void;
  onCalendar?: () => void;
  onSignOut(): void;
  open?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState(false);
  // The /preview gallery shows it open for screenshots.
  useEffect(() => {
    if (open) menu.current?.showPopover?.();
  }, [open]);
  return (
    <>
      <button type="button" popoverTarget="account-menu" className="account tap" aria-label="Account">
        {initial || (
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        )}
      </button>
      <div ref={menu} id="account-menu" popover="auto" className="menu">
        <button
          type="button"
          onClick={() => {
            menu.current?.hidePopover();
            onMemory();
          }}
          className="pill pill-small pill-quiet w-full"
        >
          Memory
        </button>
        {/* The menu stays open, so the switch shows what it did. */}
        <button type="button" role="switch" aria-checked={!muted} onClick={onMute} className="pill pill-small pill-quiet w-full">
          Sound<span aria-hidden="true"> · {muted ? "off" : "on"}</span>
        </button>
        {canvas !== null && (
          <button
            type="button"
            onClick={() => {
              menu.current?.hidePopover();
              onCanvas();
            }}
            className="pill pill-small pill-quiet w-full"
          >
            {canvas ? "Canvas · connected" : "Connect Canvas"}
          </button>
        )}
        {onCalendar && (
          <button type="button" onClick={onCalendar} className="pill pill-small pill-quiet w-full">
            Let Zeno add to your calendar
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            menu.current?.hidePopover();
            setApps(true);
          }}
          className="pill pill-small pill-quiet w-full"
        >
          Connect an app
        </button>
        {/* A full load, not a client navigation: Back must not repaint the page from this load's saved day. */}
        <a href="/privacy" className="pill pill-small pill-quiet w-full">
          Privacy
        </a>
        <button type="button" onClick={onSignOut} className="pill pill-small w-full">
          Sign out
        </button>
      </div>
      {/* Outside the popover, which hides everything inside it when it closes. */}
      <AppsSheet open={apps} onClose={() => setApps(false)} />
    </>
  );
}
