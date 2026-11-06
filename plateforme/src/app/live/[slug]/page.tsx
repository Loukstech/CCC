import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LivePlayer } from "@/components/LivePlayer";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { canViewLive, safeEmbedUrl } from "@/lib/live";
import { mux } from "@/lib/video/mux";

export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "live.title")} — CCC` };
}

const when = (d: Date, lang: Lang) =>
  d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) + " UTC";

export default function LiveWatchPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main className="flex-1 bg-brand-night text-white">
      <Suspense fallback={<p className="mx-auto max-w-5xl p-8 text-white/70" aria-busy="true">…</p>}>
        <LiveWatch params={params} />
      </Suspense>
    </main>
  );
}

async function LiveWatch({ params }: { params: Promise<{ slug: string }> }) {
  const lang = await getLang();
  const { slug } = await params;
  const user = await getCurrentUser();
  const event = await db.liveEvent.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, description: true, provider: true,
      embedUrl: true, playbackId: true, replayUrl: true, status: true,
      visibility: true, startsAt: true, endsAt: true,
      broadcaster: { select: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!event) notFound();

  // Un brouillon ou un événement archivé n'est visible que par le personnel (prévisualisation).
  if ((event.status === "DRAFT" || event.status === "ARCHIVED") && !user?.staffRole) notFound();

  const gate = await canViewLive(event.visibility, user);

  // Replay : une URL de replay validée remplace la source du direct quand l'événement est terminé.
  const ended = event.status === "ENDED";
  const replay = ended ? safeEmbedUrl(event.replayUrl) : null;
  let source: { src: string; kind: "embed" | "hls" } | null = null;
  if (replay) {
    source = { src: replay, kind: "embed" };
  } else if (!ended) {
    if (event.provider === "EMBED") {
      const url = safeEmbedUrl(event.embedUrl);
      if (url) source = { src: url, kind: "embed" };
    } else if (event.playbackId) {
      const playback = await mux.getPlayback(event.playbackId, { userId: user?.id ?? "anonymous" });
      source = { src: playback.url, kind: "hls" };
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/live" className="inline-block pb-5 text-sm text-white/70 hover:text-white">
        {t(lang, "live.back")}
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event.status === "LIVE" ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/40" : "bg-white/10 text-white/80"}`}>
          {t(lang, `live.status.${event.status}`)}
        </span>
        <span className="text-xs text-white/60">{t(lang, `live.visibility.${event.visibility}`)}</span>
        <span className="text-xs text-white/60">· {when(event.startsAt, lang)}</span>
      </div>

      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{event.title}</h1>
      {event.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{event.description}</p>}
      {event.broadcaster?.user && (
        <p className="mt-2 text-xs text-white/60">
          {t(lang, "live.broadcaster", { name: event.broadcaster.user.name ?? event.broadcaster.user.email ?? "—" })}
        </p>
      )}

      <div className="mt-6">
        {!gate.ok ? (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/85">
              {t(lang, gate.reason === "login" ? "live.notPublic" : "live.subscribersOnly")}
            </p>
            <Link
              href={gate.reason === "login" ? `/connexion?suivant=/live/${slug}` : "/abonnement"}
              className="mt-5 inline-flex rounded-full bg-gold px-5 py-2 text-sm font-semibold text-brand-night transition-colors hover:brightness-110"
            >
              {t(lang, gate.reason === "login" ? "live.signInToWatch" : "live.subscribeToWatch")}
            </Link>
          </div>
        ) : event.status === "SCHEDULED" ? (
          <p className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-sm text-white/80">
            {t(lang, "live.notStarted", { date: when(event.startsAt, lang) })}
          </p>
        ) : !source ? (
          <p className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-sm text-white/80">
            {t(lang, ended ? "live.ended" : "live.noSource")}
          </p>
        ) : (
          <LivePlayer src={source.src} kind={source.kind} title={event.title} lang={lang} />
        )}
      </div>
    </div>
  );
}
