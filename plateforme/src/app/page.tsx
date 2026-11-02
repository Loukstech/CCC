import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ChevronIcon, DownloadIcon, HeadsetIcon, ShieldIcon, TypeIcon, WalletIcon } from "@/components/icons";
import { AdSlot } from "@/components/AdSlot";
import { PageFallback } from "@/components/PageFallback";
import { getPublishedWorks, toCard, type CardItem } from "@/lib/catalog";
import { t, type Key } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

const BENEFITS: { icon: typeof DownloadIcon; title: Key; text: Key }[] = [
  { icon: DownloadIcon, title: "home.b1.title", text: "home.b1.text" },
  { icon: WalletIcon, title: "home.b2.title", text: "home.b2.text" },
  { icon: ShieldIcon, title: "home.b3.title", text: "home.b3.text" },
  { icon: HeadsetIcon, title: "home.b4.title", text: "home.b4.text" },
];

const SPACES = [
  {
    type: "BOOK",
    href: "/livres",
    label: "nav.books",
    text: "home.space.BOOK",
    tone: "from-brand to-brand-deep",
  },
  {
    type: "DOCUMENTARY",
    href: "/documentaires",
    label: "nav.docs",
    text: "home.space.DOCUMENTARY",
    tone: "from-[#0e5a73] to-brand-deep",
  },
  {
    type: "FILM",
    href: "/films",
    label: "nav.films",
    text: "home.space.FILM",
    tone: "from-[#2a2f6e] to-brand-night",
  },
] as const satisfies readonly { type: string; href: string; label: Key; text: Key; tone: string }[];

/** La langue vient d'un cookie : la page se charge derrière un cadre d'attente. */
export default function Home() {
  return (
    <Suspense fallback={<PageFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const lang = await getLang();
  const works = await getPublishedWorks();

  if (works.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-5">
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
          {t(lang, "home.noCatalog")}
        </p>
      </main>
    );
  }

  const items = works.map((w, i) => toCard(w, i < 3, lang));
  const byType = (t: CardItem["type"]) => items.filter((i) => i.type === t);

  return (
    <main className="flex-1">
      <HeroCarousel items={items.slice(0, 5)} />

      <section aria-label={t(lang, "home.benefits")} className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:px-5">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line shadow-xl shadow-brand/10 ring-1 ring-line lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 bg-surface p-4 sm:gap-4 sm:px-5 sm:py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-brand sm:size-12">
                <Icon className="size-5 sm:size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink sm:text-base">{t(lang, title)}</p>
                <p className="text-xs text-muted sm:text-sm">{t(lang, text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="espaces" className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-5 sm:pt-14">
        <h2 id="espaces" className="font-display text-2xl font-semibold text-brand sm:text-3xl">
          {t(lang, "home.chooseSpace")}
        </h2>
        <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-gold" />

        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {SPACES.map(({ type, href, label, text, tone }) => {
            const list = byType(type);
            return (
              <li key={type}>
                <Link
                  href={href}
                  className={`group relative flex h-44 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg shadow-brand/10 transition-transform active:scale-[0.98] md:h-64 md:hover:-translate-y-1`}
                >
                  <div className="film-strip absolute inset-0 opacity-30" aria-hidden />
                  <div className="relative max-w-[60%]">
                    <TypeIcon type={type} className="size-7 text-gold" />
                    <p className="font-display mt-2 text-2xl font-semibold">{t(lang, label)}</p>
                    <p className="mt-0.5 text-sm text-white/70">{t(lang, text)}</p>
                  </div>
                  <span className="relative inline-flex items-center gap-1 text-sm font-semibold text-gold">
                    {t(lang, "home.titles", { n: list.length })}
                    <ChevronIcon className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>

                  <div aria-hidden className="absolute -right-2 bottom-3 flex w-[46%] items-end md:bottom-5">
                    {list.slice(0, 3).map((w, i) => (
                      <div
                        key={w.id}
                        className="w-[58%] shrink-0 shadow-xl shadow-black/40"
                        style={{
                          marginLeft: i === 0 ? 0 : "-22%",
                          transform: `rotate(${(i - 1) * 7}deg) translateY(${i === 1 ? "-8%" : "0"})`,
                          zIndex: i === 1 ? 2 : 1,
                        }}
                      >
                        <Cover type={w.type} title={w.title} coverUrl={w.coverUrl} className="ring-1 ring-white/25" />
                      </div>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <AdSlot placement="HOME" lang={lang} />

      <section aria-label={t(lang, "auth.signup")} className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-5 sm:py-14">
        <div className="hero-bg relative overflow-hidden rounded-3xl px-5 py-8 text-white sm:px-12 sm:py-10">
          <div className="film-strip absolute inset-y-0 right-0 w-1/2 opacity-30" aria-hidden />
          <div className="relative max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{t(lang, "home.freeAccount")}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-balance sm:text-4xl">
              {t(lang, "home.accountTitle")}
            </h2>
            <p className="mt-3 text-sm text-white/75 sm:text-base">
              {t(lang, "home.accountText")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="btn btn-primary w-full sm:w-auto">
                {t(lang, "auth.signup")}
              </Link>
              <Link href="/connexion" className="btn btn-ghost w-full sm:w-auto">
                {t(lang, "home.haveAccount")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label={t(lang, "home.appAria")} className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand sm:text-2xl">{t(lang, "home.appTitle")}</h2>
            <p className="mt-1 max-w-lg text-sm text-muted sm:text-base">
              {t(lang, "home.appText")}
            </p>
          </div>
          <div className="flex gap-3 text-sm font-semibold">
            <span className="rounded-full bg-brand/10 px-5 py-2.5 text-brand">Android</span>
            <span className="rounded-full bg-brand/10 px-5 py-2.5 text-brand">iPhone</span>
          </div>
        </div>
      </section>
    </main>
  );
}
