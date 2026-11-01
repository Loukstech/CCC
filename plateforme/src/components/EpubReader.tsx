"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, EpubCFI as EpubCFIType, NavItem, Rendition } from "epubjs";
import { BookmarkIcon, ChevronIcon } from "@/components/icons";

type ThemeName = "paper" | "sepia" | "night";
type Bookmark = { id: string; locator: string; label: string | null; percent: number };
type Here = { start: string; end: string; href: string; pct: number };
type Compare = (a: string, b: string) => number;

const THEMES: Record<ThemeName, { label: string; bg: string; fg: string }> = {
  paper: { label: "Clair", bg: "#fbf8f1", fg: "#1b1b1b" },
  sepia: { label: "Sépia", bg: "#f1e6cc", fg: "#3b2f1c" },
  night: { label: "Nuit", bg: "#0a1020", fg: "#d8deec" },
};
const THEME_ORDER: ThemeName[] = ["paper", "sepia", "night"];
const SIZE_MIN = 80;
const SIZE_MAX = 180;
const PREFS_KEY = "ccc-reader";

type Props = {
  workId: string;
  slug: string;
  title: string;
  initialLocator: string | null;
  initialPercent: number;
};

/**
 * Lecteur EPUB plein écran. Le livre est téléchargé par la route protégée /api/books/[id]/file
 * (compte, bibliothèque et pays vérifiés par le serveur) puis affiché dans le navigateur.
 * La position de lecture est enregistrée côté serveur : le livre se rouvre à la même page sur tous les appareils.
 */
export function EpubReader({ workId, slug, title, initialLocator, initialPercent }: Props) {
  const viewer = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ cfi: string; pct: number } | null>(null);

  const [theme, setTheme] = useState<ThemeName>("paper");
  const [size, setSize] = useState(110);
  const [percent, setPercent] = useState(initialPercent);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [panel, setPanel] = useState<"toc" | "marks" | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [here, setHere] = useState<Here | null>(null);
  const [compare, setCompare] = useState<Compare | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const flush = useCallback(
    (keepalive = false) => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      fetch(`/api/books/${workId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locator: p.cfi, percent: p.pct }),
        keepalive,
      }).catch(() => {
        /* hors connexion : la position sera renvoyée au prochain changement de page */
      });
    },
    [workId],
  );

  const applyTheme = useCallback((name: ThemeName) => {
    rendition.current?.themes.select(name);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let book: Book | null = null;

    (async () => {
      try {
        const mod = await import("epubjs");
        const ePub = mod.default;
        const res = await fetch(`/api/books/${workId}/file`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        if (cancelled || !viewer.current) return;

        book = ePub(data);
        const r = book.renderTo(viewer.current, { width: "100%", height: "100%", flow: "paginated", spread: "none" });
        rendition.current = r;

        for (const [name, t] of Object.entries(THEMES)) {
          r.themes.register(name, {
            body: { background: `${t.bg} !important`, color: `${t.fg} !important` },
            "p, h1, h2, h3, li, span, em": { color: "inherit !important" },
            a: { color: "inherit !important" },
          });
        }

        // Préférences de lecture mémorisées sur cet appareil.
        let prefs: { theme?: ThemeName; size?: number } = {};
        try {
          prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
        } catch {
          /* préférences illisibles : valeurs par défaut */
        }
        const t0: ThemeName = prefs.theme && prefs.theme in THEMES ? prefs.theme : "paper";
        const s0 = typeof prefs.size === "number" ? Math.min(SIZE_MAX, Math.max(SIZE_MIN, prefs.size)) : 110;
        r.themes.select(t0);
        r.themes.fontSize(`${s0}%`);
        setTheme(t0);
        setSize(s0);

        // Comparaison de deux positions du livre (pour savoir si la page affichée porte un signet).
        const CFI =
          (mod as unknown as { EpubCFI?: typeof EpubCFIType }).EpubCFI ??
          (ePub as unknown as { CFI?: typeof EpubCFIType }).CFI;
        if (CFI) setCompare(() => (a: string, b: string) => new CFI().compare(a, b));

        r.on("relocated", (loc: { start: { cfi: string; percentage: number; href: string }; end: { cfi: string } }) => {
          const total = book?.locations.length() ?? 0;
          const pct = Math.round((total ? book!.locations.percentageFromCfi(loc.start.cfi) : loc.start.percentage) * 100);
          setPercent(pct);
          setHere({ start: loc.start.cfi, end: loc.end.cfi, href: loc.start.href, pct });
          pending.current = { cfi: loc.start.cfi, pct };
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => flush(), 1500);
        });

        // Glisser du doigt pour tourner la page.
        let startX = 0;
        r.on("touchstart", (e: TouchEvent) => {
          startX = e.changedTouches[0].screenX;
        });
        r.on("touchend", (e: TouchEvent) => {
          const dx = e.changedTouches[0].screenX - startX;
          if (Math.abs(dx) > 50) void (dx < 0 ? r.next() : r.prev());
        });
        r.on("keyup", (e: KeyboardEvent) => {
          if (e.key === "ArrowLeft") void r.prev();
          if (e.key === "ArrowRight") void r.next();
        });

        await r.display(initialLocator ?? undefined);
        if (cancelled) return;
        setStatus("ready");

        book.loaded.navigation.then((nav) => !cancelled && setToc(nav.toc));
        fetch(`/api/books/${workId}/bookmarks`)
          .then((res) => (res.ok ? res.json() : []))
          .then((items: Bookmark[]) => !cancelled && setBookmarks(items))
          .catch(() => {});
        // Les « emplacements » permettent de calculer un pourcentage de lecture fiable.
        book.ready.then(() => book?.locations.generate(1200)).catch(() => {});
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    const onHide = () => document.visibilityState === "hidden" && flush(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") void rendition.current?.prev();
      if (e.key === "ArrowRight") void rendition.current?.next();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("keyup", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      cancelled = true;
      flush(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("keyup", onKey);
      document.body.style.overflow = "";
      rendition.current = null;
      book?.destroy();
    };
  }, [workId, initialLocator, flush]);

  const savePrefs = (next: { theme?: ThemeName; size?: number }) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, size, ...next }));
    } catch {
      /* stockage indisponible */
    }
  };
  const changeSize = (delta: number) => {
    const next = Math.min(SIZE_MAX, Math.max(SIZE_MIN, size + delta));
    setSize(next);
    rendition.current?.themes.fontSize(`${next}%`);
    savePrefs({ size: next });
  };
  const nextTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    applyTheme(next);
    savePrefs({ theme: next });
  };
  const goTo = (target: string) => {
    void rendition.current?.display(target);
    setPanel(null);
  };

  // Un signet est « sur cette page » si sa position tombe entre le début et la fin de la page affichée.
  const page = here;
  const marked =
    page &&
    bookmarks.find((b) =>
      compare ? compare(b.locator, page.start) >= 0 && compare(b.locator, page.end) <= 0 : b.locator === page.start,
    );

  const chapterOf = (href: string) => {
    const file = href.split("#")[0];
    return toc.find((i) => i.href.split("#")[0] === file || file.endsWith(i.href.split("#")[0]))?.label.trim();
  };

  const deleteRemote = (id: string) =>
    fetch(`/api/books/${workId}/bookmarks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});

  const removeBookmark = (id: string) => {
    setBookmarks((list) => list.filter((b) => b.id !== id));
    void deleteRemote(id);
  };

  const toggleBookmark = async () => {
    if (!page) return;
    if (marked) {
      removeBookmark(marked.id);
      return;
    }
    const label = `${chapterOf(page.href) ?? "Page"} — ${page.pct} %`;
    try {
      const res = await fetch(`/api/books/${workId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locator: page.start, label, percent: page.pct }),
      });
      if (res.ok) {
        const created: Bookmark = await res.json();
        setBookmarks((list) =>
          list.some((b) => b.id === created.id) ? list : [...list, created].sort((a, b) => a.percent - b.percent),
        );
      }
    } catch {
      /* hors connexion : le signet n'est pas créé */
    }
  };

  const t = THEMES[theme];
  const bar = "flex items-center gap-1 px-2";
  const btn =
    "grid h-11 min-w-11 place-items-center rounded-lg px-2 text-sm font-semibold transition-colors hover:bg-black/10 active:bg-black/15";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: t.bg, color: t.fg }}
      role="region"
      aria-label={`Lecture : ${title}`}
    >
      <div className={`${bar} h-12 shrink-0 border-b`} style={{ borderColor: `${t.fg}22` }}>
        <Link href={`/oeuvres/${slug}`} className={btn} aria-label="Quitter la lecture">
          <ChevronIcon dir="left" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium opacity-80">{title}</p>
        <button
          type="button"
          className={btn}
          onClick={() => void toggleBookmark()}
          disabled={!page}
          aria-pressed={!!marked}
          aria-label={marked ? "Retirer le signet de cette page" : "Ajouter un signet sur cette page"}
        >
          <BookmarkIcon filled={!!marked} className={`size-5 ${marked ? "text-gold" : ""}`} />
        </button>
        <button type="button" className={btn} onClick={() => setPanel((v) => (v ? null : "toc"))} aria-expanded={!!panel}>
          Menu
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={viewer} className="absolute inset-0 mx-auto max-w-3xl px-1" />
        {status === "loading" && (
          <p className="absolute inset-0 grid place-items-center text-sm opacity-70">Ouverture du livre…</p>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="font-semibold">Impossible d’ouvrir ce livre.</p>
              <p className="mt-1 text-sm opacity-70">Vérifiez votre connexion, puis rouvrez la lecture.</p>
              <Link href={`/oeuvres/${slug}`} className="btn btn-primary mt-4">
                Retour à la fiche
              </Link>
            </div>
          </div>
        )}
        {status === "ready" && (
          <>
            <button
              type="button"
              aria-label="Page précédente"
              onClick={() => void rendition.current?.prev()}
              className="absolute inset-y-0 left-0 w-[18%] cursor-w-resize"
            />
            <button
              type="button"
              aria-label="Page suivante"
              onClick={() => void rendition.current?.next()}
              className="absolute inset-y-0 right-0 w-[18%] cursor-e-resize"
            />
          </>
        )}

        {panel && (
          <div
            className="absolute inset-y-0 right-0 z-10 flex w-72 max-w-[85%] flex-col border-l shadow-2xl"
            style={{ background: t.bg, borderColor: `${t.fg}22` }}
          >
            <div role="tablist" className="flex shrink-0 border-b" style={{ borderColor: `${t.fg}22` }}>
              {(["toc", "marks"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={panel === k}
                  onClick={() => setPanel(k)}
                  className={`h-12 flex-1 text-sm font-semibold transition-opacity ${panel === k ? "border-b-2 border-gold" : "opacity-60"}`}
                >
                  {k === "toc" ? "Sommaire" : `Signets (${bookmarks.length})`}
                </button>
              ))}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {panel === "toc" && toc.length === 0 && <li className="px-2 py-2 text-sm opacity-70">Sommaire indisponible.</li>}
              {panel === "toc" &&
                toc.map((item) => (
                  <li key={item.id ?? item.href}>
                    <button
                      type="button"
                      onClick={() => goTo(item.href)}
                      className="w-full rounded-lg px-2 py-3 text-left text-sm hover:bg-black/10"
                    >
                      {item.label.trim()}
                    </button>
                  </li>
                ))}
              {panel === "marks" && bookmarks.length === 0 && (
                <li className="px-2 py-3 text-sm opacity-70">
                  Aucun signet. Touchez le marque-page en haut pour garder la page en cours.
                </li>
              )}
              {panel === "marks" &&
                bookmarks.map((b) => (
                  <li key={b.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => goTo(b.locator)}
                      className="min-w-0 flex-1 rounded-lg px-2 py-3 text-left text-sm hover:bg-black/10"
                    >
                      <span className="block truncate">{b.label ?? "Signet"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBookmark(b.id)}
                      aria-label={`Supprimer le signet : ${b.label ?? "Signet"}`}
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-lg hover:bg-black/10"
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t pb-[env(safe-area-inset-bottom)]" style={{ borderColor: `${t.fg}22` }}>
        <div className="h-1 w-full" style={{ background: `${t.fg}18` }} aria-hidden>
          <div className="h-full bg-gold transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <div className={`${bar} h-14 justify-between`}>
          <button type="button" className={btn} onClick={() => void rendition.current?.prev()} aria-label="Page précédente">
            <ChevronIcon dir="left" />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className={btn} onClick={() => changeSize(-10)} aria-label="Réduire le texte" disabled={size <= SIZE_MIN}>
              A<span className="text-[10px]">−</span>
            </button>
            <button type="button" className={btn} onClick={() => changeSize(10)} aria-label="Agrandir le texte" disabled={size >= SIZE_MAX}>
              A<span className="text-[10px]">+</span>
            </button>
            <button type="button" className={`${btn} min-w-16`} onClick={nextTheme} aria-label={`Ambiance : ${t.label}. Changer`}>
              {t.label}
            </button>
          </div>
          <span className="w-12 text-center text-xs tabular-nums opacity-70" aria-label="Avancement">
            {percent}%
          </span>
          <button type="button" className={btn} onClick={() => void rendition.current?.next()} aria-label="Page suivante">
            <ChevronIcon dir="right" />
          </button>
        </div>
      </div>
    </div>
  );
}
