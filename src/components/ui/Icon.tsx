import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
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
