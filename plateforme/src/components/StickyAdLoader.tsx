import { StickyAd } from "@/components/AdSlot";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/settings";

/** Affiche le bandeau publicitaire fixe s'il est actif et si le réglage l'autorise. */
export async function StickyAdLoader() {
  const [lang, settings] = await Promise.all([getLang(), getSettings()]);
  if (settings.ads_sticky_enabled !== "true") return null;
  // Le bandeau est masqué par CSS dans la console (/admin/*), qui occupe tout l'écran.
  return (
    <div className="ccc-site-chrome">
      <StickyAd lang={lang} />
    </div>
  );
}
