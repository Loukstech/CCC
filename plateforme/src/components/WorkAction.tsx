import Link from "next/link";
import { addToLibrary } from "@/app/actions/library";
import { setCountry } from "@/app/actions/country";
import { startPurchase } from "@/app/actions/payments";
import { COUNTRIES, COUNTRY_NAME } from "@/lib/countries";

type Props = {
  workId: string;
  type: "BOOK" | "FILM" | "DOCUMENTARY";
  access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
  signedIn: boolean;
  country: string | null;
  available: boolean;
  owned: boolean;
  subscribed: boolean;
  /** Prix à afficher sur le bouton d'achat (pays de l'utilisateur). */
  priceLabel: string | null;
  readHref?: string;
  watchHref?: string;
};

const disabled = "btn btn-primary h-auto min-h-11 w-full cursor-not-allowed py-2.5 text-center opacity-50 sm:w-auto";
const badge =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40";

/** Bouton d'action de la fiche : selon le compte, le pays (droits), l'achat ou l'abonnement. */
export function WorkAction({
  workId,
  type,
  access,
  signedIn,
  country,
  available,
  owned,
  subscribed,
  priceLabel,
  readHref,
  watchHref,
}: Props) {
  const included = !owned && subscribed && access === "SUBSCRIPTION" && available;
  if (owned || included) {
    const open = readHref ?? watchHref;
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {open ? (
          <Link href={open} className="btn btn-primary w-full sm:w-auto">
            {readHref ? "Lire" : "Regarder"}
          </Link>
        ) : (
          type !== "BOOK" && (
            <button type="button" disabled className={disabled}>
              Vidéo bientôt disponible
            </button>
          )
        )}
        <span className={badge}>{owned ? "✓ Dans votre bibliothèque" : "✓ Inclus dans votre abonnement"}</span>
        <Link href={owned ? "/bibliotheque" : "/compte"} className="btn btn-ghost w-full sm:w-auto">
          {owned ? "Ma bibliothèque" : "Mon abonnement"}
        </Link>
      </div>
    );
  }

  if (country && !available) {
    return (
      <button type="button" disabled className={disabled}>
        Non disponible en {COUNTRY_NAME[country] ?? country}
      </button>
    );
  }

  if (access === "FREE") {
    if (!signedIn) {
      return (
        <Link href="/connexion" className="btn btn-primary w-full sm:w-auto">
          Se connecter pour l’ajouter
        </Link>
      );
    }
    if (!country) {
      return (
        <button type="button" disabled className={disabled}>
          Choisissez votre pays ci-dessous
        </button>
      );
    }
    return (
      <form action={addToLibrary}>
        <input type="hidden" name="workId" value={workId} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          Ajouter gratuitement à ma bibliothèque
        </button>
      </form>
    );
  }

  if (access === "PURCHASE") {
    if (!signedIn) {
      return (
        <Link href="/connexion" className="btn btn-primary w-full sm:w-auto">
          Se connecter pour acheter
        </Link>
      );
    }
    if (!country) {
      return (
        <button type="button" disabled className={disabled}>
          Choisissez votre pays ci-dessous
        </button>
      );
    }
    if (!priceLabel) {
      return (
        <button type="button" disabled className={disabled}>
          Prix à venir pour votre pays
        </button>
      );
    }
    return (
      <form action={startPurchase}>
        <input type="hidden" name="workId" value={workId} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          Acheter · {priceLabel}
        </button>
      </form>
    );
  }

  return (
    <Link href="/abonnement" className="btn btn-primary w-full sm:w-auto">
      S’abonner pour accéder
    </Link>
  );
}

/** Ligne d'état des droits (disponible ou non dans le pays) et choix du pays. */
export function Availability({ country, available }: { country: string | null; available: boolean }) {
  const name = country ? (COUNTRY_NAME[country] ?? country) : null;
  return (
    <div className="mt-5 text-sm">
      <p className={country ? (available ? "text-emerald-300" : "text-amber-300") : "text-white/80"}>
        {!country && "Pays non déterminé : choisissez-le pour vérifier la disponibilité."}
        {country && available && `✓ Disponible en ${name}`}
        {country && !available && `Cette œuvre n’est pas disponible en ${name} (droits de diffusion).`}
      </p>
      <form action={setCountry} className="mt-2 flex max-w-xs gap-2">
        <label className="sr-only" htmlFor="country">
          Votre pays
        </label>
        <select
          id="country"
          name="country"
          defaultValue={country ?? ""}
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 text-base text-white backdrop-blur sm:text-sm [&>option]:text-ink"
        >
          {!country && <option value="">Choisir mon pays</option>}
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg border border-white/30 px-3 text-sm font-medium text-white hover:bg-white/10">
          Changer
        </button>
      </form>
    </div>
  );
}
