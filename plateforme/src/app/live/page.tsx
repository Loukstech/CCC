import Link from "next/link";
import { Suspense } from "react";
import { LiveIcon } from "@/components/icons";
import { PageFallback } from "@/components/PageFallback";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { PUBLIC_LIVE_STATUSES } from "@/lib/live";

export const metadata = { title: "En direct — CCC" };

// Page bilingue et alimentée par la base : rendu à la demande, pas de prérendu statique.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "live.title")} — CCC` };
}

const when = (d: Date, lang: Lang) =>
  d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "UTC",
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) + " UTC";

export default function LivePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<PageFallback />}>
        <LiveList />
      </Suspense>
    </main>
  );
}

async function LiveList() {
  const lang = await getLang();
  const events = await db.liveEvent.findMany({
    where: { status: { in: [...PUBLIC_LIVE_STATUSES] } },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    take: 40,
    select: {
      id: true, slug: true, title: true, description: true, status: true,
      visibility: true, startsAt: true, endsAt: true, replayUrl: true,
      broadcaster: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  const live = events.filter((e) => e.status === "LIVE");
  const upcoming = events.filter((e) => e.status === "SCHEDULED");
  const past = events.filter((e) => e.status === "ENDED" || e.replayUrl);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
          <LiveIcon className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "live.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t(lang, "live.lead")}</p>
        </div>
      </header>

      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          {t(lang, "live.empty")}
        </p>
      ) : (
        <>
          <Section title={t(lang, "live.liveNow", { n: live.length })} lang={lang} events={live} />
          <Section title={t(lang, "live.upcoming", { n: upcoming.length })} lang={lang} events={upcoming} />
          <Section title={t(lang, "live.past", { n: past.length })} lang={lang} events={past} />
        </>
      )}
    </div>
  );
}

type Event = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "ARCHIVED";
  visibility: "PUBLIC" | "AUTHENTICATED" | "SUBSCRIBERS";
  startsAt: Date;
  endsAt: Date | null;
  replayUrl: string | null;
  broadcaster: { user: { name: string | null; email: string | null } } | null;
};

function Section({ title, events, lang }: { title: string; events: Event[]; lang: Lang }) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-brand">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  e.status === "LIVE" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-brand/10 text-brand"
                }`}
              >
                {t(lang, `live.status.${e.status}`)}
              </span>
              <span className="text-xs text-muted">{t(lang, `live.visibility.${e.visibility}`)}</span>
            </div>
            <h3 className="font-display mt-3 text-lg font-semibold text-ink">{e.title}</h3>
            {e.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{e.description}</p>}
            <p className="mt-2 text-xs text-muted">{t(lang, "live.startsAt", { date: when(e.startsAt, lang) })}</p>
            {e.broadcaster?.user && (
              <p className="mt-1 text-xs text-muted">
                {t(lang, "live.broadcaster", { name: e.broadcaster.user.name ?? e.broadcaster.user.email ?? "—" })}
              </p>
            )}
            <Link
              href={`/live/${e.slug}`}
              className="mt-4 inline-flex rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
            >
              {e.status === "ENDED" ? t(lang, "live.replay") : t(lang, "live.watch")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
