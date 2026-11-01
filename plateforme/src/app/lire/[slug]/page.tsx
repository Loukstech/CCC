import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EpubReader } from "@/components/EpubReader";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { authorizeRead } from "@/lib/reading";

export const metadata = { title: "Lecture — CCC" };

export default function ReadPage({ params }: PageProps<"/lire/[slug]">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Ouverture du livre…</p>}>
      <Reader params={params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: PageProps<"/lire/[slug]">["params"] }) {
  const { slug } = await params;
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

  return (
    <EpubReader
      workId={access.work.id}
      slug={access.work.slug}
      title={access.work.title}
      initialLocator={progress?.locator ?? null}
      initialPercent={Math.round(progress?.position ?? 0)}
    />
  );
}
