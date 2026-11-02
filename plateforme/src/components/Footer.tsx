import Image from "next/image";
import Link from "next/link";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSegment } from "@/components/ThemeToggle";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

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
            <li><Link href="/compte" className="hover:text-gold">{t(lang, "nav.myAccount")}</Link></li>
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
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-white/50 sm:px-5">
          {t(lang, "footer.copy")}{" "}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
            Pexels
          </a>
        </p>
      </div>
    </footer>
  );
}
