import { BottomNav } from "@/components/BottomNav";
import { getLang } from "@/lib/lang";

/** Lit la langue (cookie) côté serveur, puis affiche la barre d'onglets du téléphone. */
export async function BottomNavLoader() {
  return <BottomNav lang={await getLang()} />;
}
