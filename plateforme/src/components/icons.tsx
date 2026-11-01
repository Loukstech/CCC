const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type P = { className?: string };

export const BookIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" />
    <path d="M12 6.5V19.5" />
  </svg>
);

export const FilmIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M10 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    <path d="M3 8h2M3 12h2M3 16h2M19 8h2M19 12h2M19 16h2" />
  </svg>
);

export const GlobeIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);

export const SearchIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const ChevronIcon = ({ className = "size-5", dir = "right" }: P & { dir?: "left" | "right" }) => (
  <svg {...base} className={className} style={dir === "left" ? { transform: "scaleX(-1)" } : undefined}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const PlayIcon = ({ className = "size-5" }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
);

export const DownloadIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
  </svg>
);

export const ShieldIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const WalletIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M16 14.5h2" />
  </svg>
);

export const HeadsetIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
  </svg>
);

export const GiftIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="9" width="18" height="11" rx="1.5" />
    <path d="M12 9v11M3 13h18M12 9c-2-4-6-3-5 0 .5 1.5 3 1 5 0Zm0 0c2-4 6-3 5 0-.5 1.5-3 1-5 0Z" />
  </svg>
);

export const TypeIcon = ({ type, className }: P & { type: "BOOK" | "FILM" | "DOCUMENTARY" }) =>
  type === "BOOK" ? <BookIcon className={className} /> : type === "FILM" ? <FilmIcon className={className} /> : <GlobeIcon className={className} />;

export const BookmarkIcon = ({ className = "size-5", filled = false }: P & { filled?: boolean }) => (
  <svg {...base} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.8L6 20V5a1 1 0 0 1 1-1Z" />
  </svg>
);

export const HomeIcon =({ className = "size-6" }: P) => (
  <svg {...base} className={className}>
    <path d="m3.5 11 8.5-7 8.5 7M6 9.5V20h12V9.5" />
  </svg>
);
