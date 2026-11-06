import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdInterstitial } from "@/components/AdInterstitial";
import { EpubReader } from "@/components/EpubReader";
import { getAds } from "@/lib/ads";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { authorizeRead } from "@/lib/reading";
import { getLang } from "@/lib/lang";

export const metadata = { title: "Lecture — CCC" };

export default function ReadPage({ params }: PageProps<"/lire/[slug]">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">…</p>}>
      <Reader params={params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: PageProps<"/lire/[slug]">["params"] }) {
  const { slug } = await params;
  const lang = await getLang();
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const access = await authorizeRead(user, { slug });
  if (!access.ok) {
    if (access.reason === "not-found") notFound();
    // Limite d'appareils atteinte : la page du compte permet d'en retirer un.
    if (access.reason === "device") redirect("/compte?appareils=limite");
    // Pas dans la bibliothèque, pays non autorisé ou fichier absent : la fiche explique pourquoi.
    redirect(`/oeuvres/${slug}`);
  }

  const progress = await db.progress.findUnique({
    where: { userId_workId: { userId: user.id, workId: access.work.id } },
    select: { locator: true, position: true },
  });

  // Publicité intercalée pour les livres gratuits : une minute de lecture, puis retour au texte.
  const breakAds = access.work.access === "FREE" ? await getAds("INTERSTITIAL") : [];
  const fallbackAds = breakAds.length === 0 && access.work.access === "FREE" ? await getAds("WORK") : [];
  const ads = breakAds.length > 0 ? breakAds : fallbackAds;

  return (
    <>
      <EpubReader
        workId={access.work.id}
        slug={access.work.slug}
        title={access.work.title}
        lang={lang}
        bookLanguage={access.work.language}
        initialLocator={progress?.locator ?? null}
        initialPercent={Math.round(progress?.position ?? 0)}
      />
      {ads.length > 0 && (
        <AdInterstitial ads={ads} lang={lang} workId={access.work.id} mode="reading" delayMs={60_000} />
      )}
    </>
  );
}
