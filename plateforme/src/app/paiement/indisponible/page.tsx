import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

// Page bilingue : elle lit la langue dans les cookies, donc elle ne peut pas être prérendue.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "pay.soonTitle")} — CCC` };
}

/**
 * Page affichée quand l'achat ou l'abonnement est demandé alors qu'aucun prestataire de paiement
 * réel n'est branché. On préfère une explication honnête à une fausse page de paiement.
 */
export default async function PaymentUnavailablePage() {
  const lang = await getLang();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-brand">{t(lang, "pay.soonTitle")}</h1>
        <p className="mt-3 text-sm text-muted">{t(lang, "pay.soonText")}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/" className="btn btn-primary">
            {t(lang, "pay.soonBack")}
          </Link>
          <Link href="/compte" className="btn border border-line">
            {t(lang, "pay.soonAccount")}
          </Link>
        </div>
      </div>
    </main>
  );
}
