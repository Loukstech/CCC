"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, FilmIcon, GlobeIcon, HomeIcon, LiveIcon, SearchIcon } from "@/components/icons";
import { t, type Key, type Lang } from "@/lib/i18n";

const TABS: { href: string; label: Key; icon: typeof HomeIcon }[] = [
  { href: "/", label: "nav.home", icon: HomeIcon },
  { href: "/livres", label: "nav.books", icon: BookIcon },
  { href: "/documentaires", label: "nav.docs", icon: GlobeIcon },
  { href: "/films", label: "nav.films", icon: FilmIcon },
  { href: "/live", label: "nav.live", icon: LiveIcon },
  { href: "/recherche", label: "nav.search", icon: SearchIcon },
];

/** Barre d'onglets fixée en bas de l'écran sur téléphone : accès au pouce aux grands espaces. */
export function BottomNav({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t(lang, "nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="grid grid-cols-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-tight transition-colors ${
                  active ? "text-brand" : "text-muted active:text-brand"
                }`}
              >
                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" />}
                <Icon className="size-6" />
                {t(lang, label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
