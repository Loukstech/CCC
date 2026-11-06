import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderShell } from "@/components/HeaderShell";
import { SearchIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { HtmlLang } from "@/components/HtmlLang";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getCurrentUser } from "@/lib/dal";
import { t, type Key, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { logout } from "@/app/actions/auth";

const link =
  "hdr-link rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap text-ink/75 transition-colors hover:bg-brand/5 hover:text-brand sm:px-3.5";

const NAV: { href: string; label: Key }[] = [
  { href: "/", label: "nav.home" },
  { href: "/livres", label: "nav.books" },
  { href: "/documentaires", label: "nav.docs" },
  { href: "/films", label: "nav.films" },
  { href: "/live", label: "nav.live" },
];

async function UserNav({ lang }: { lang: Lang }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Link href="/connexion" className={link}>
          {t(lang, "auth.login")}
        </Link>
        <Link href="/inscription" className="btn btn-brand ml-1 h-10 px-4 whitespace-nowrap sm:px-5">
          <span className="sm:hidden">{t(lang, "auth.signupShort")}</span>
          <span className="hidden sm:inline">{t(lang, "auth.signup")}</span>
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/bibliotheque" className={link}>
        <span className="sm:hidden">{t(lang, "nav.libraryShort")}</span>
        <span className="hidden sm:inline">{t(lang, "nav.library")}</span>
      </Link>
      {user.staffRole && (
        <Link href="/admin" className={`${link} hidden sm:block`}>
          {t(lang, "nav.admin")}
        </Link>
      )}
      <Link href="/ecrivain" className={`${link} hidden sm:block`}>
        {t(lang, "nav.writer")}
      </Link>
      <Link href="/compte" aria-label={t(lang, "nav.myAccount")} className="hdr-muted mx-1 flex items-center gap-2 text-sm text-muted">
        <span
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
        >
          {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate lg:inline">{user.name ?? user.email}</span>
      </Link>
      <form action={logout} className="hidden sm:block">
        <button type="submit" className={link}>
          {t(lang, "nav.logout")}
        </button>
      </form>
    </>
  );
}

function SearchBox({ className = "", placeholder, label }: { className?: string; placeholder: string; label: string }) {
  return (
    <form action="/recherche" role="search" className={`hdr-search ${className}`}>
      <label className="relative block">
        <span className="sr-only">{label}</span>
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

export async function Header() {
  const lang = await getLang();
  return (
    <HeaderShell>
      <HtmlLang lang={lang} />
      <div className="rainbow-bar" aria-hidden />
      <div className="site-header-bar border-b border-line bg-paper/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-5">
          <Link href="/" aria-label={t(lang, "logo.home")} className="flex shrink-0 items-center">
            <Image
              src="/logo-color.png"
              alt={t(lang, "logo.alt")}
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

          <nav aria-label={t(lang, "nav.catalog")} className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="hdr-link relative rounded-md px-3 py-2 text-sm font-medium text-ink/75 transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:text-brand hover:after:scale-x-100"
              >
                {t(lang, n.label)}
              </Link>
            ))}
          </nav>

          <SearchBox
            className="mx-auto hidden w-full max-w-sm lg:block"
            placeholder={t(lang, "search.placeholder")}
            label={t(lang, "search.label")}
          />

          <nav aria-label={t(lang, "nav.account")} className="ml-auto flex shrink-0 items-center gap-1">
            <Link href="/recherche" aria-label={t(lang, "search.aria")} className={`${link} hidden md:block lg:hidden`}>
              <SearchIcon />
            </Link>
            <CurrencySwitcher lang={lang} className="hidden 2xl:inline-flex" />
            <LanguageSwitch lang={lang} className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Suspense fallback={<span className="h-10 w-24" />}>
              <UserNav lang={lang} />
            </Suspense>
          </nav>
        </div>

        <div className="hdr-searchrow px-4 pb-3 md:hidden">
          <SearchBox placeholder={t(lang, "search.placeholderShort")} label={t(lang, "search.label")} />
        </div>
      </div>
    </HeaderShell>
  );
}
