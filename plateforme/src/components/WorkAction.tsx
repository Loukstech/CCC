import Link from "next/link";
import { addToLibrary } from "@/app/actions/library";
import { setCountry } from "@/app/actions/country";
import { COUNTRIES, COUNTRY_NAME } from "@/lib/countries";

type Props = {
  workId: string;
  access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
  signedIn: boolean;
  country: string | null;
  available: boolean;
  owned: boolean;
  readHref?: string;
};

const disabled = "btn btn-primary h-auto min-h-11 w-full cursor-not-allowed py-2.5 text-center opacity-50 sm:w-auto";

/** Bouton d'action de la fiche : selon le compte, le pays (droits) et ce que l'on possède déjà. */
export function WorkAction({ workId, access, signedIn, country, available, owned, readHref }: Props) {
  if (owned) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {readHref && (
          <Link href={readHref} className="btn btn-primary w-full sm:w-auto">
            Lire
          </Link>
        )}
        <span className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40">
          ✓ Dans votre bibliothèque
        </span>
        <Link href="/bibliotheque" className="btn btn-ghost w-full sm:w-auto">
          Ma bibliothèque
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

  return (
    <button type="button" disabled className={disabled}>
      {access === "PURCHASE" ? "Achat : bientôt disponible" : "Abonnement : bientôt disponible"}
    </button>
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
