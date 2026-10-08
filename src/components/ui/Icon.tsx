import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3z" />,
  admin: <path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4zM8 12l3 3 5-6" />,
  daily: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  ranks: <path d="M5 20V12M12 20V4M19 20V8" />,
  artist: (
    <>
      <path d="M9 18V5l12-2v13M9 7l12-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="18" cy="16" rx="3" ry="3" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
  rewind: (
    <>
      <path d="M9 8 4 12l5 4" />
      <path d="M4 12h9a5 5 0 1 1-2.1-4.08" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h3l4 3V7l-4 3H4z" fill="currentColor" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
};
export function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.play}
    </svg>
  );
}
