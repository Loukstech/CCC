import Image from "next/image";
import Link from "next/link";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSegment } from "@/components/ThemeToggle";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SITE, COPYRIGHT_YEAR } from "@/lib/site";

export async function Footer() {
  const lang = await getLang();
  return (
    <footer className="bg-brand-night text-white/70">
      <div className="rainbow-bar" aria-hidden />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-5 sm:py-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
        <div>
          <Image src="/logo-white.png" alt={t(lang, "logo.alt")} width={916} height={582} className="h-20 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{t(lang, "footer.tag")}</p>
        </div>
        <nav aria-label={t(lang, "footer.explore")}>
          <p className="text-sm font-semibold text-white">{t(lang, "footer.explore")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/livres" className="hover:text-gold">{t(lang, "nav.books")}</Link></li>
            <li><Link href="/documentaires" className="hover:text-gold">{t(lang, "nav.docs")}</Link></li>
            <li><Link href="/films" className="hover:text-gold">{t(lang, "nav.films")}</Link></li>
            <li><Link href="/abonnement" className="hover:text-gold">{t(lang, "footer.subscription")}</Link></li>
            <li><Link href="/recherche" className="hover:text-gold">{t(lang, "nav.search")}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t(lang, "nav.myAccount")}>
          <p className="text-sm font-semibold text-white">{t(lang, "nav.myAccount")}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/connexion" className="hover:text-gold">{t(lang, "auth.login")}</Link></li>
            <li><Link href="/inscription" className="hover:text-gold">{t(lang, "auth.signup")}</Link></li>
          </ul>
        </nav>
        <div className="md:col-span-3">
          <p className="mb-2 text-sm font-semibold text-white">{t(lang, "footer.display")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeSegment />
            <LanguageSwitch lang={lang} />
            <CurrencySwitcher lang={lang} />
          </div>
          <p className="mt-2 max-w-xl text-xs text-white/50">{t(lang, "currency.note")}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>{t(lang, "footer.copy", { year: COPYRIGHT_YEAR })}</span>
            <span aria-hidden className="text-white/25">·</span>
            <Link href="/contact" className="underline-offset-2 hover:text-gold hover:underline">
              {t(lang, "nav.contact")}
            </Link>
          </p>
          <p className="sm:text-right">
            {t(lang, "footer.credit")}{" "}
            {SITE.developerUrl ? (
              <a
                href={SITE.developerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/75 underline-offset-2 hover:text-gold hover:underline"
              >
                {SITE.developer}
              </a>
            ) : (
              <strong className="font-semibold text-white/75">{SITE.developer}</strong>
            )}
          </p>
        </div>
        <div className="border-t border-white/5">
          <p className="mx-auto w-full max-w-6xl px-4 py-3 text-xs text-white/40 sm:px-5">
            {t(lang, "footer.demo")} · {t(lang, "footer.photos")}{" "}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
              Pexels
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
