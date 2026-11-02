import Link from "next/link";
import { addToLibrary } from "@/app/actions/library";
import { setCountry } from "@/app/actions/country";
import { startPurchase } from "@/app/actions/payments";
import { Money } from "@/components/Money";
import { COUNTRIES, countryName } from "@/lib/countries";
import { t, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  workId: string;
  type: "BOOK" | "FILM" | "DOCUMENTARY";
  access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
  signedIn: boolean;
  country: string | null;
  available: boolean;
  owned: boolean;
  subscribed: boolean;
  /** Prix du bouton d'achat (pays de l'utilisateur), dans sa devise d'origine. */
  price: { amount: number; currency: string } | null;
  readHref?: string;
  watchHref?: string;
};

const disabled = "btn btn-primary h-auto min-h-11 w-full cursor-not-allowed py-2.5 text-center opacity-50 sm:w-auto";
const badge =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/40";

/** Bouton d'action de la fiche : selon le compte, le pays (droits), l'achat ou l'abonnement. */
export function WorkAction({
  lang,
  workId,
  type,
  access,
  signedIn,
  country,
  available,
  owned,
  subscribed,
  price,
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
            {t(lang, readHref ? "wa.read" : "wa.watch")}
          </Link>
        ) : (
          type !== "BOOK" && (
            <button type="button" disabled className={disabled}>
              {t(lang, "wa.videoSoon")}
            </button>
          )
        )}
        <span className={badge}>{t(lang, owned ? "wa.inLibrary" : "wa.inSub")}</span>
        <Link href={owned ? "/bibliotheque" : "/compte"} className="btn btn-ghost w-full sm:w-auto">
          {t(lang, owned ? "wa.myLibrary" : "wa.mySub")}
        </Link>
      </div>
    );
  }

  if (country && !available) {
    return (
      <button type="button" disabled className={disabled}>
        {t(lang, "wa.notAvailableIn", { country: countryName(country, lang) })}
      </button>
    );
  }

  if (access === "FREE") {
    if (!signedIn) {
      return (
        <Link href="/connexion" className="btn btn-primary w-full sm:w-auto">
          {t(lang, "wa.signinAdd")}
        </Link>
      );
    }
    if (!country) {
      return (
        <button type="button" disabled className={disabled}>
          {t(lang, "wa.chooseCountry")}
        </button>
      );
    }
    return (
      <form action={addToLibrary}>
        <input type="hidden" name="workId" value={workId} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {t(lang, "wa.addFree")}
        </button>
      </form>
    );
  }

  if (access === "PURCHASE") {
    if (!signedIn) {
      return (
        <Link href="/connexion" className="btn btn-primary w-full sm:w-auto">
          {t(lang, "wa.signinBuy")}
        </Link>
      );
    }
    if (!country) {
      return (
        <button type="button" disabled className={disabled}>
          {t(lang, "wa.chooseCountry")}
        </button>
      );
    }
    if (!price) {
      return (
        <button type="button" disabled className={disabled}>
          {t(lang, "wa.priceSoon")}
        </button>
      );
    }
    return (
      <form action={startPurchase}>
        <input type="hidden" name="workId" value={workId} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {t(lang, "wa.buy")} · <Money amount={price.amount} currency={price.currency} lang={lang} />
        </button>
      </form>
    );
  }

  return (
    <Link href="/abonnement" className="btn btn-primary w-full sm:w-auto">
      {t(lang, "wa.subscribe")}
    </Link>
  );
}

/** Ligne d'état des droits (disponible ou non dans le pays) et choix du pays. */
export function Availability({ country, available, lang }: { country: string | null; available: boolean; lang: Lang }) {
  const name = country ? countryName(country, lang) : "";
  return (
    <div className="mt-5 text-sm">
      <p className={country ? (available ? "text-emerald-300" : "text-amber-300") : "text-white/80"}>
        {!country && t(lang, "av.unknown")}
        {country && available && t(lang, "av.available", { name })}
        {country && !available && t(lang, "av.notAvailable", { name })}
      </p>
      <form action={setCountry} className="mt-2 flex max-w-xs gap-2">
        <label className="sr-only" htmlFor="country">
          {t(lang, "av.yourCountry")}
        </label>
        <select
          id="country"
          name="country"
          defaultValue={country ?? ""}
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/30 bg-white/10 px-3 text-base text-white backdrop-blur sm:text-sm [&>option]:text-ink"
        >
          {!country && <option value="">{t(lang, "av.chooseMine")}</option>}
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {countryName(c.code, lang)}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg border border-white/30 px-3 text-sm font-medium text-white hover:bg-white/10">
          {t(lang, "av.change")}
        </button>
      </form>
    </div>
  );
}
