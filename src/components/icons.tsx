// One outline icon set for the whole app (Vi, Nov 4: "use the icon wherever necessary… not too different from other
// apps… don't overwhelm with words"). 24-unit grid, current color, 1.75 stroke, so icons sit with the Index Card's ink.
// Decorative by default: the button or link around an icon carries the words (visible, or aria-label when icon-only).
import type { ReactNode } from "react";

const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  skip: <path d="M6 6.5v11l8-5.5zM17.5 6.5v11" />,
  adjust: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  week: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9.2 10v10.5M14.8 10v10.5" />
    </>
  ),
  apps: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z" />
      <circle cx="12" cy="13.5" r="3.25" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  doc: <path d="M14 3.5H7.5a2 2 0 00-2 2v13a2 2 0 002 2h9a2 2 0 002-2V8zM14 3.5V8h4.5M9 13h6M9 16.5h4" />,
  reply: <path d="M10 8.5L5 13.5l5 5M5 13.5h9.5a5 5 0 005-5v-2" />,
  external: <path d="M14 4.5h5.5V10M19.5 4.5L11 13M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7.5l8 5.5 8-5.5" />
    </>
  ),
  flag: <path d="M5.5 21V4.5M5.5 4.5h11l-2.2 4 2.2 4h-11" />,
  listAdd: <path d="M4 6.5h11M4 12h11M4 17.5h6M17.5 14.5v6M14.5 17.5h6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.4 2.4 0 014.8 0c0 1.7-2.4 1.9-2.4 3.7M12 16.8v.2" />
    </>
  ),
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 015 3.5h8.5A1.5 1.5 0 0115 5v.5" />
    </>
  ),
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  link: <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" />,
  memory: <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.9a4.3 4.3 0 017.5 2.6c0 5.4-7.5 10-7.5 10z" />,
  sparkle: <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.8 2 2 .7-2 .8-.8 2-.7-2-2-.8 2-.7z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
