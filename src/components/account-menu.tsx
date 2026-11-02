"use client";

import { useEffect, useRef } from "react";

// The person's initial in the top bar opens Privacy and Sign out.
export default function AccountMenu({ initial, onSignOut, open }: { initial: string; onSignOut(): void; open?: boolean }) {
  const menu = useRef<HTMLDivElement>(null);
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
        {/* A full load, not a client navigation: Back must not repaint the page from this load's saved day. */}
        <a href="/privacy" className="pill pill-small pill-quiet w-full">
          Privacy
        </a>
        <button type="button" onClick={onSignOut} className="pill pill-small w-full">
          Sign out
        </button>
      </div>
    </>
  );
}
