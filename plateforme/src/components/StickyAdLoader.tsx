import { StickyAd } from "@/components/AdSlot";
import { getLang } from "@/lib/lang";

/** Lit la langue (cookie) puis affiche le bandeau publicitaire fixe, s'il y en a un d'actif. */
export async function StickyAdLoader() {
  return <StickyAd lang={await getLang()} />;
}
