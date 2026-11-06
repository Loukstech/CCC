import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdInterstitial } from "@/components/AdInterstitial";
import { VideoPlayer } from "@/components/VideoPlayer";
import { getAds } from "@/lib/ads";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { authorizeWatch } from "@/lib/reading";
import { getVideoProvider } from "@/lib/video";

export const metadata = { title: "Visionnage — CCC" };

export default function WatchPage({ params }: PageProps<"/regarder/[slug]">) {
  return (
    <main className="flex-1 bg-brand-night text-white">
      <Suspense fallback={<p className="mx-auto max-w-5xl p-8 text-white/70" aria-busy="true">…</p>}>
        <Watch params={params} />
      </Suspense>
    </main>
  );
}

async function Watch({ params }: { params: PageProps<"/regarder/[slug]">["params"] }) {
  const lang = await getLang();
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const access = await authorizeWatch(user, { slug });
  if (!access.ok) {
    if (access.reason === "not-found") notFound();
    if (access.reason === "device") redirect("/compte?appareils=limite");
    // Pas d'abonnement ni d'achat, pays non autorisé ou vidéo absente : la fiche explique pourquoi.
    redirect(`/oeuvres/${slug}`);
  }

  const [playback, progress, work, subtitles] = await Promise.all([
    getVideoProvider(access.work.fileKey).getPlayback(access.work.fileKey, { userId: user.id }),
    db.progress.findUnique({
      where: { userId_workId: { userId: user.id, workId: access.work.id } },
      select: { position: true, locator: true },
    }),
    db.work.findUniqueOrThrow({ where: { id: access.work.id }, select: { description: true, durationMin: true } }),
    // Pistes de sous-titres : la piste par défaut d'abord, puis l'ordre alphabétique des langues.
    db.subtitle.findMany({
      where: { workId: access.work.id },
      orderBy: [{ isDefault: "desc" }, { lang: "asc" }],
      select: { lang: true, label: true, src: true, isDefault: true },
    }),
  ]);

  // Reprise : on ne reprend pas dans les dernières secondes (vidéo terminée : on recommence).
  const duration = Number(progress?.locator ?? 0);
  const resume = progress && duration > 0 && progress.position < duration - 8 ? Math.floor(progress.position) : 0;

  // Publicité intercalée, réservée aux œuvres gratuites : celui qui a payé ne la voit pas.
  // À défaut d'annonce prévue pour l'interruption, on réutilise celles de la fiche d'œuvre.
  const breakAds = access.work.access === "FREE" ? await getAds("INTERSTITIAL") : [];
  const fallbackAds = breakAds.length === 0 && access.work.access === "FREE" ? await getAds("WORK") : [];
  const ads = breakAds.length > 0 ? breakAds : fallbackAds;
  // Courte vidéo de démonstration : la coupure arrive tôt, sinon elle ne se verrait jamais.
  const breakDelay = (work.durationMin ?? 0) <= 2 ? 10_000 : 90_000;

  return (
    <div className="mx-auto w-full max-w-5xl px-0 pb-10 sm:px-5 sm:pt-6">
      <Link href={`/oeuvres/${access.work.slug}`} className="inline-block px-4 py-3 text-sm text-white/70 hover:text-white sm:px-0">
        ← {access.work.title}
      </Link>
      <VideoPlayer
        workId={access.work.id}
        title={access.work.title}
        lang={lang}
        src={playback.url}
        kind={playback.kind}
        initialPosition={resume}
        tracks={subtitles}
        watermark={`${user.name ?? user.email ?? t(lang, "video.subscriber")} · ${user.id.slice(-6).toUpperCase()}`}
      />
      {ads.length > 0 && (
        <AdInterstitial ads={ads} lang={lang} workId={access.work.id} mode="video" delayMs={breakDelay} />
      )}
      <div className="px-4 pt-5 sm:px-0">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{access.work.title}</h1>
        {access.work.author && <p className="mt-1 text-white/70">{access.work.author}</p>}
        {work.description && <p className="mt-3 max-w-2xl leading-relaxed text-white/80">{work.description}</p>}
      </div>
    </div>
  );
}
