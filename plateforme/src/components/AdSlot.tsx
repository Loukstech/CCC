import { AdBanner } from "@/components/AdBanner";
import { getAds, type AdPlacementKey } from "@/lib/ads";
import type { Lang } from "@/lib/i18n";

/** Emplacement publicitaire : n'affiche rien tant qu'aucune publicité n'est active à cet endroit. */
export async function AdSlot({ placement, lang }: { placement: Exclude<AdPlacementKey, "STICKY">; lang: Lang }) {
  const ads = await getAds(placement);
  if (ads.length === 0) return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5">
      <AdBanner ads={ads} lang={lang} />
    </div>
  );
}

/** Bandeau fixé en bas de l'écran (au-dessus de la barre d'onglets sur téléphone). */
export async function StickyAd({ lang }: { lang: Lang }) {
  const ads = await getAds("STICKY");
  if (ads.length === 0) return null;
  return <AdBanner ads={ads} lang={lang} variant="sticky" />;
}
