"use client";

import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";

const KEY = "ccc-theme";
const ORDER: Mode[] = ["system", "light", "dark"];
const LABEL: Record<Mode, string> = { system: "Système", light: "Clair", dark: "Sombre" };

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function subscribe(notify: () => void) {
  window.addEventListener("ccc-theme", notify);
  window.addEventListener("storage", notify);
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readMode() === "system") apply("system");
  };
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener("ccc-theme", notify);
    window.removeEventListener("storage", notify);
    media.removeEventListener("change", onSystem);
  };
}

function useTheme() {
  const mode = useSyncExternalStore(subscribe, readMode, (): Mode => "system");

  const choose = (next: Mode) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page seulement */
    }
    apply(next);
    window.dispatchEvent(new Event("ccc-theme"));
  };

  return { mode, choose };
}

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-5",
  "aria-hidden": true,
};

function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === "light")
    return (
      <svg {...icon}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
    );
  if (mode === "dark")
    return (
      <svg {...icon}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
    );
  return (
    <svg {...icon}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Bouton d'en-tête : un appui passe de Système à Clair puis Sombre. */
export function ThemeToggle() {
  const { mode, choose } = useTheme();
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Thème : ${LABEL[mode]}. Passer à : ${LABEL[next]}`}
      title={`Thème : ${LABEL[mode]}`}
      className="hdr-link grid size-10 shrink-0 place-items-center rounded-full text-ink/75 transition-colors hover:bg-brand/5 hover:text-brand"
    >
      <ModeIcon mode={mode} />
    </button>
  );
}

/** Choix explicite des trois modes (pied de page). */
export function ThemeSegment() {
  const { mode, choose } = useTheme();
  return (
    <div role="group" aria-label="Thème d’affichage" className="inline-flex rounded-xl bg-white/10 p-1">
      {ORDER.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => choose(m)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
            mode === m ? "bg-white text-brand-night" : "text-white/70 hover:text-white"
          }`}
        >
          <ModeIcon mode={m} />
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
