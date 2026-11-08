"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Coque plein écran de la console d'administration.
 *
 * Pensée pour un écran de PC : volet de navigation fixe de 256 px, barre supérieure collante,
 * contenu sans largeur maximale autre que 1920 px (les grilles de la vue d'ensemble exploitent
 * donc toute la largeur disponible). Sur petit écran, le volet devient un tiroir.
 *
 * Les libellés sont traduits côté serveur et passés en props : ce composant ne connaît ni le
 * dictionnaire ni la base. `children` reste un rendu serveur (tableaux, graphiques, formulaires).
 */

export type ConsoleNavLink = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export type ConsoleNavGroup = {
  id: string;
  label: string;
  items: ConsoleNavLink[];
};

const GLYPHS: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  catalogue: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" /></>,
  manuscripts: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  moderation: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  dioceses: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  partners: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13" /><path d="M12 8H7.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zM12 8h4.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z" /></>,
  lives: <><circle cx="12" cy="12" r="2.5" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" /></>,
  finances: <><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M16 14.5h2" /><path d="M6 6V4.5A1.5 1.5 0 0 1 7.5 3h9" /></>,
  ads: <><path d="M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M18 9a4 4 0 0 1 0 6M20.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  tools: <><path d="M14.5 6.5a4.5 4.5 0 0 0-5.8 5.8L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 5.8-5.8l-2.9 2.9-2.1-2.1z" /></>,
  audit: <><path d="M8 4h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" /><path d="M8 4v4H4M8 12h8M8 16h6" /></>,
};

function Glyph({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] shrink-0"
      aria-hidden
    >
      {GLYPHS[name] ?? GLYPHS.dashboard}
    </svg>
  );
}

export function ConsoleShell({
  groups,
  eyebrow,
  fallbackTitle,
  roleLabel,
  userName,
  dense,
  readOnlyNote,
  isReadOnly,
  labels,
  children,
}: {
  groups: ConsoleNavGroup[];
  eyebrow: string;
  fallbackTitle: string;
  roleLabel: string;
  userName: string;
  dense: boolean;
  isReadOnly: boolean;
  readOnlyNote: string;
  labels: {
    menu: string;
    close: string;
    backToSite: string;
    refresh: string;
    period: string;
    role: string;
  };
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const allLinks = groups.flatMap((g) => g.items);
  // Le lien le plus long qui préfixe l'URL gagne : /admin/outils ne doit pas activer /admin.
  const current =
    [...allLinks].sort((a, b) => b.href.length - a.href.length).find((l) =>
      l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href),
    ) ?? null;

  const nav = (
    <nav aria-label={labels.menu} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-brand/12 text-brand ring-1 ring-brand/20"
                        : "text-ink/70 hover:bg-brand/5 hover:text-brand"
                    }`}
                  >
                    <Glyph name={item.icon} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-brand tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen w-full bg-paper text-ink">
      {/* Volet latéral : fixe sur grand écran, tiroir sur mobile. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface shadow-xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-tight text-white">
            CCC
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-ink">{eyebrow}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted">Back office</p>
          </div>
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setOpen(false)}
            className="ml-auto rounded-md p-1 text-muted hover:bg-brand/5 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {nav}

        <div className="shrink-0 border-t border-line p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted hover:bg-brand/5 hover:text-brand"
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M10 6 4 12l6 6M4 12h10a6 6 0 0 1 6 6" />
            </svg>
            {labels.backToSite}
          </Link>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label={labels.close}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur lg:px-5">
          <button
            type="button"
            aria-label={labels.menu}
            onClick={() => setOpen(true)}
            className="rounded-lg border border-line p-1.5 text-ink hover:bg-brand/5 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
              {eyebrow}
            </p>
            <h1 className="truncate text-sm font-semibold text-ink">
              {current?.label ?? fallbackTitle}
            </h1>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              title={labels.refresh}
              className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand sm:inline-flex"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
              </svg>
              {labels.refresh}
            </button>
            <span className="hidden rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-brand md:inline">
              {roleLabel}
            </span>
            <span className="hidden text-[11px] text-muted xl:inline">{userName}</span>
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white"
            >
              {(userName || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {isReadOnly && (
          <p className="border-b border-gold/40 bg-gold-soft/30 px-4 py-2 text-xs text-ink lg:px-5">
            {readOnlyNote}
          </p>
        )}

        <main
          className={`mx-auto w-full max-w-[1920px] ${dense ? "px-3 py-4 lg:px-5 lg:py-5 2xl:px-7" : "px-5 py-8"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
