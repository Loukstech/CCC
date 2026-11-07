import Link from "next/link";
import { Suspense } from "react";
import { ContactForm } from "@/components/ContactForm";
import { PageFallback } from "@/components/PageFallback";
import { HeadsetIcon } from "@/components/icons";
import { t, type Key, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { SITE, isDemoContact, phoneHref, whatsappHref } from "@/lib/site";

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "contact.title")} — CCC` };
}

/** Rendu à la demande : la langue vient d'un cookie, comme sur les autres pages bilingues. */
export default function ContactPage() {
  return (
    <main className="flex-1">
      <Suspense fallback={<PageFallback />}>
        <ContactContent />
      </Suspense>
    </main>
  );
}

const SUBJECTS: { value: string; key: Key }[] = [
  { value: "account", key: "contact.subjectAccount" },
  { value: "payment", key: "contact.subjectPayment" },
  { value: "device", key: "contact.subjectDevice" },
  { value: "content", key: "contact.subjectContent" },
  { value: "bug", key: "contact.subjectBug" },
  { value: "other", key: "contact.subjectOther" },
];

const FAQ: { q: Key; a: Key }[] = [
  { q: "contact.faq1.q", a: "contact.faq1.a" },
  { q: "contact.faq2.q", a: "contact.faq2.a" },
  { q: "contact.faq3.q", a: "contact.faq3.a" },
  { q: "contact.faq4.q", a: "contact.faq4.a" },
];

const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";

async function ContactContent() {
  const lang: Lang = await getLang();
  const subjects = SUBJECTS.map((s) => ({ value: s.value, label: t(lang, s.key) }));
  const wa = whatsappHref(SITE.whatsapp);
  const tel = phoneHref(SITE.contactPhone);

  return (
    <>
      <section className="hero-bg text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{t(lang, "contact.kicker")}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-balance sm:text-5xl">
            {t(lang, "contact.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-white/75">{t(lang, "contact.lead")}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-5 sm:py-12">
        {isDemoContact() && (
          <p role="note" className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-200">
            <strong>{t(lang, "footer.demo")}.</strong> {t(lang, "contact.demoNote")}
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-10">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-semibold text-ink">{t(lang, "contact.channels")}</h2>

            <div className={card}>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">{t(lang, "contact.emailLabel")}</p>
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="mt-2 inline-block text-lg font-semibold text-brand underline-offset-4 hover:underline break-all"
              >
                {SITE.contactEmail}
              </a>
              <p className="mt-2 text-sm text-muted">{t(lang, "contact.emailHint")}</p>
            </div>

            {wa && (
              <div className={card}>
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">{t(lang, "contact.whatsappLabel")}</p>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-lg font-semibold text-brand underline-offset-4 hover:underline">
                  +{SITE.whatsapp.replace(/\D/g, "")}
                </a>
                <p className="mt-2 text-sm text-muted">{t(lang, "contact.whatsappHint")}</p>
              </div>
            )}

            {tel && (
              <div className={card}>
                <p className="text-xs font-semibold tracking-wider text-muted uppercase">{t(lang, "contact.phoneLabel")}</p>
                <a href={tel} className="mt-2 inline-block text-lg font-semibold text-brand underline-offset-4 hover:underline">
                  {SITE.contactPhone}
                </a>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-2xl bg-brand/5 px-5 py-4 text-sm text-muted ring-1 ring-brand/10">
              <HeadsetIcon className="size-6 shrink-0 text-brand" />
              <p>{t(lang, "contact.response")}</p>
            </div>
          </div>

          {/* Ancre utilisée par le lien « Signaler un problème » du pied de page. */}
          <div id="probleme" className={`${card} scroll-mt-24 sm:p-6`}>
            <h2 className="font-display text-xl font-semibold text-ink">{t(lang, "contact.formTitle")}</h2>
            <p className="mt-1 mb-5 text-sm text-muted">{t(lang, "contact.formLead")}</p>
            <ContactForm lang={lang} to={SITE.contactEmail} subjects={subjects} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-5 sm:pb-16">
        <h2 className="font-display text-2xl font-semibold text-ink">{t(lang, "contact.faqTitle")}</h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t(lang, "contact.faqSub")}</p>
        <div className="flex flex-col gap-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-line bg-surface px-4 py-3">
              <summary className="cursor-pointer list-none font-medium text-ink marker:hidden">
                {t(lang, q)}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(lang, a)}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/compte" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t(lang, "nav.myAccount")}
          </Link>
          <Link href="/bibliotheque" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t(lang, "nav.library")}
          </Link>
        </p>
      </section>
    </>
  );
}
