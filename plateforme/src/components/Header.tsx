import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderShell } from "@/components/HeaderShell";
import { SearchIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

const link =
  "hdr-link rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap text-ink/75 transition-colors hover:bg-brand/5 hover:text-brand sm:px-3.5";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/livres", label: "Livres" },
  { href: "/documentaires", label: "Documentaires" },
  { href: "/films", label: "Films" },
];

async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Link href="/connexion" className={link}>
          Connexion
        </Link>
        <Link href="/inscription" className="btn btn-brand ml-1 h-10 px-4 whitespace-nowrap sm:px-5">
          <span className="sm:hidden">S’inscrire</span>
          <span className="hidden sm:inline">Créer un compte</span>
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/bibliotheque" className={link}>
        <span className="sm:hidden">Bibliothèque</span>
        <span className="hidden sm:inline">Ma bibliothèque</span>
      </Link>
      {user.staffRole && (
        <Link href="/admin" className={`${link} hidden sm:block`}>
          Administration
        </Link>
      )}
      <span className="hdr-muted mx-1 hidden items-center gap-2 text-sm text-muted lg:flex">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
        >
          {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </span>
        {user.name ?? user.email}
      </span>
      <form action={logout}>
        <button type="submit" className={link}>
          Déconnexion
        </button>
      </form>
    </>
  );
}

function SearchBox({ className = "", placeholder }: { className?: string; placeholder: string }) {
  return (
    <form action="/recherche" role="search" className={`hdr-search ${className}`}>
      <label className="relative block">
        <span className="sr-only">Rechercher une œuvre</span>
        <SearchIcon className="hdr-search-icon pointer-events-none absolute z-10 top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          required
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-line bg-surface pr-4 pl-11 text-base outline-none transition focus:border-brand-light focus:ring-4 focus:ring-brand-light/15 sm:text-sm"
        />
      </label>
    </form>
  );
}

export function Header() {
  return (
    <HeaderShell>
      <div className="site-header-bar border-b border-line bg-paper/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-5">
          <Link href="/" aria-label="CCC — accueil" className="flex shrink-0 items-center">
            <Image
              src="/logo-color.png"
              alt="CCC — Le savoir prend vie"
              width={916}
              height={582}
              className="logo-color h-11 w-auto sm:h-12"
              priority
            />
            <Image
              src="/logo-white.png"
              alt=""
              width={916}
              height={582}
              className="logo-white h-11 w-auto sm:h-12"
              priority
            />
          </Link>

          <nav aria-label="Catalogue" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="hdr-link relative rounded-md px-3 py-2 text-sm font-medium text-ink/75 transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:text-brand hover:after:scale-x-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <SearchBox
            className="mx-auto hidden w-full max-w-sm lg:block"
            placeholder="Rechercher un livre, un film, un auteur…"
          />

          <nav aria-label="Compte" className="ml-auto flex shrink-0 items-center gap-1">
            <Link href="/recherche" aria-label="Rechercher" className={`${link} hidden md:block lg:hidden`}>
              <SearchIcon />
            </Link>
            <ThemeToggle />
            <Suspense fallback={<span className="h-10 w-24" />}>
              <UserNav />
            </Suspense>
          </nav>
        </div>

        <div className="hdr-searchrow px-4 pb-3 md:hidden">
          <SearchBox placeholder="Rechercher un livre, un film…" />
        </div>
      </div>
    </HeaderShell>
  );
}
