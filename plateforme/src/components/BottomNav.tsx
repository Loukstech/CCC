"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, FilmIcon, GlobeIcon, HomeIcon, SearchIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Accueil", icon: HomeIcon },
  { href: "/livres", label: "Livres", icon: BookIcon },
  { href: "/documentaires", label: "Documentaires", icon: GlobeIcon },
  { href: "/films", label: "Films", icon: FilmIcon },
  { href: "/recherche", label: "Recherche", icon: SearchIcon },
];

/** Barre d'onglets fixée en bas de l'écran sur téléphone : accès au pouce aux grands espaces. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="grid grid-cols-5">
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
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
