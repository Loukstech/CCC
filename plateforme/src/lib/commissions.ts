import "server-only";

/**
 * Barème des commissions (lot 4).
 *
 * Principe : le prestataire de paiement prélève ses frais sur le montant encaissé. Les commissions se
 * partagent ensuite le **net réellement reçu**, jamais le brut — sinon la somme des parts dépasse ce
 * qui est entré en caisse (c'était le défaut du cahier des charges : 90 % + 10 % du brut, sans place
 * pour les frais).
 *
 * Barème proposé et appliqué par défaut, sur le net :
 *   - écrivain 70 % — il reste majoritaire, c'est ce que le client veut défendre ;
 *   - diocèse  10 % — la part promise aux diocèses ;
 *   - plateforme 20 % — hébergement, vidéo, support, frais divers.
 *
 * Tout est réglable par variables d'environnement, sans redéploiement de code :
 *   CCC_FEE_PPM=200            frais du prestataire, 2 % du brut
 *   CCC_WRITER_PPM=7000        part écrivain (70 %)
 *   CCC_DIOCESE_PPM=1000       part diocèse (10 %)
 *   CCC_PLATFORM_PPM=2000      part plateforme (20 %)
 *   CCC_SUB_DIOCESE_PPM=1000   part diocèse sur un abonnement (10 %)
 *
 * Les taux sont exprimés en points de base (10 000 = 100 %) pour éviter les arrondis flottants.
 */

export const PPM = 10_000;

export type RateSet = {
  writerPpm: number;
  diocesePpm: number;
  platformPpm: number;
};

function envPpm(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > PPM) return fallback;
  return value;
}

/** Frais du prestataire de paiement, en points de base du montant encaissé. */
export function feePpm(): number {
  return envPpm("CCC_FEE_PPM", 200);
}

/** Barème d'une vente d'œuvre. La part plateforme absorbe l'arrondi et comble un éventuel manque. */
export function rates(): RateSet {
  const writerPpm = envPpm("CCC_WRITER_PPM", 7_000);
  const diocesePpm = envPpm("CCC_DIOCESE_PPM", 1_000);
  // Une somme de parts supérieure à 100 % est refusée : on revient au barème par défaut.
  if (writerPpm + diocesePpm > PPM) return { writerPpm: 7_000, diocesePpm: 1_000, platformPpm: 2_000 };
  return { writerPpm, diocesePpm, platformPpm: PPM - writerPpm - diocesePpm };
}

/** Barème d'un abonnement : il n'y a pas d'écrivain à rémunérer, le diocèse garde sa part. */
export function subscriptionRates(): RateSet {
  const diocesePpm = envPpm("CCC_SUB_DIOCESE_PPM", 1_000);
  return { writerPpm: 0, diocesePpm, platformPpm: PPM - diocesePpm };
}

export type Split = {
  /** Montant encaissé auprès de l'acheteur, frais compris. */
  gross: number;
  /** Frais du prestataire. */
  fee: number;
  /** Ce qui reste réellement : base de toutes les commissions. */
  net: number;
  writer: number;
  diocese: number;
  platform: number;
};

export type SaleKind = "WORK" | "SUBSCRIPTION";

/**
 * Découpe un montant encaissé. La somme des parts vaut exactement le net : aucune commission ne peut
 * être payée avec de l'argent qui n'a pas été reçu.
 */
export function splitSale(gross: number, kind: SaleKind = "WORK"): Split {
  const safeGross = Math.max(0, Math.round(gross));
  const fee = Math.round((safeGross * feePpm()) / PPM);
  const net = safeGross - fee;
  const r = kind === "SUBSCRIPTION" ? subscriptionRates() : rates();
  const writer = Math.floor((net * r.writerPpm) / PPM);
  const diocese = Math.floor((net * r.diocesePpm) / PPM);
  return { gross: safeGross, fee, net, writer, diocese, platform: net - writer - diocese };
}

/** Résumé lisible du barème, pour l'écran d'administration. */
export function rateSummary() {
  const sale = rates();
  const sub = subscriptionRates();
  return {
    feePpm: feePpm(),
    sale,
    subscription: sub,
    warning: sale.writerPpm + sale.diocesePpm + sale.platformPpm !== PPM,
  };
}
