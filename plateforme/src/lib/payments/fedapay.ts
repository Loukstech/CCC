import "server-only";
import type { CheckoutInput, CheckoutResult, PaymentProvider } from "@/lib/payments";
import { markOrderFailed, markOrderPaid, markOrderRefunded } from "@/lib/payments/fulfill";

/**
 * Adaptateur FedaPay (sandbox d'abord, live plus tard).
 *
 * Deux principes, imposés par la documentation officielle :
 * - le statut renvoyé dans l'URL de retour n'est jamais fiable : on revérifie toujours auprès de l'API ;
 * - le webhook n'est qu'un signal de réveil : c'est `GET /transactions/{id}`, authentifié par notre clé
 *   secrète, qui fait foi. Un webhook forgé ne peut donc pas valider une commande impayée.
 *
 * Endpoints utilisés :
 *   POST /transactions                 créer la collecte
 *   POST /transactions/{id}/token      obtenir { token, url } : l'URL de la page de paiement
 *   GET  /transactions/{id}            statut, merchant_reference, fees, amount_transferred
 *
 * Bases : https://sandbox-api.fedapay.com/v1 (test) et https://api.fedapay.com/v1 (live).
 * Les objets et les clés des deux environnements sont totalement distincts.
 */

const SANDBOX_API = "https://sandbox-api.fedapay.com/v1";
const LIVE_API = "https://api.fedapay.com/v1";

export type FedaPayTransaction = {
  id: number | string;
  status: string;
  amount: number;
  merchant_reference?: string | null;
  custom_metadata?: Record<string, unknown> | null;
  fees?: number | null;
  commission?: number | null;
  fixed_commission?: number | null;
  amount_transferred?: number | null;
  mode?: string | null;
};

function environment(): "sandbox" | "live" {
  return process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox";
}

function apiBase(): string {
  return environment() === "live" ? LIVE_API : SANDBOX_API;
}

function secretKey(): string {
  const key = process.env.FEDAPAY_SECRET_KEY;
  if (!key) {
    throw new Error(`FEDAPAY_SECRET_KEY manquante (environnement ${environment()})`);
  }
  return key;
}

/** URL publique du site, pour le callback_url. En local, un tunnel HTTPS est nécessaire. */
function siteUrl(): string {
  const raw =
    process.env.CCC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3200");
  return raw.replace(/\/+$/, "");
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`FedaPay ${init.method ?? "GET"} ${path} : HTTP ${res.status} — ${detail}`);
  }
  return (await res.json()) as T;
}

function hasId(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && "id" in value;
}

/** La doc montre un objet transaction direct ; on tolère aussi une enveloppe { data } ou { transaction }. */
function unwrap<T>(payload: unknown): T {
  if (hasId(payload)) return payload as T;
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (hasId(value)) return value as T;
    }
  }
  throw new Error("Réponse FedaPay inattendue : objet transaction introuvable");
}

function nameParts(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] ?? "Lecteur",
    lastname: parts.slice(1).join(" ") || parts[0] || "CCC",
  };
}

export const fedapay: PaymentProvider = {
  id: "fedapay",

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // FedaPay ne règle qu'en XOF. Les prix des autres pays sont convertis en amont (providerCharge).
    if (input.currency !== "XOF") {
      throw new Error(`FedaPay n'encaisse qu'en XOF (devise reçue : ${input.currency})`);
    }

    const { firstname, lastname } = nameParts(input.customer.name);
    const customer = input.customer.email
      ? { firstname, lastname, email: input.customer.email }
      : undefined;

    const created = await api<unknown>("/transactions", {
      method: "POST",
      body: JSON.stringify({
        description: (input.description || "Commande CCC").slice(0, 255),
        amount: input.amount,
        currency: { iso: "XOF" },
        callback_url: `${siteUrl()}/paiement/retour?order=${encodeURIComponent(input.orderId)}`,
        // Référence unique : c'est elle qui relie la transaction FedaPay à notre commande.
        merchant_reference: input.orderId,
        custom_metadata: { orderId: input.orderId },
        ...(customer ? { customer } : {}),
      }),
    });
    const transaction = unwrap<{ id: number | string }>(created);

    const token = await api<{ token?: string; url?: string }>(
      `/transactions/${encodeURIComponent(String(transaction.id))}/token`,
      { method: "POST" },
    );
    if (!token.url || !/^https?:\/\//i.test(token.url)) {
      throw new Error("FedaPay n'a pas renvoyé d'URL de paiement exploitable");
    }
    return { redirectUrl: token.url, providerRef: String(transaction.id) };
  },
};

export async function getFedaPayTransaction(providerRef: string): Promise<FedaPayTransaction> {
  const payload = await api<unknown>(`/transactions/${encodeURIComponent(providerRef)}`);
  return unwrap<FedaPayTransaction>(payload);
}

/**
 * Frais réellement supportés par le marchand.
 *
 * `amount_transferred` est le montant qui arrive sur le compte FedaPay : `amount - transferred` est donc
 * la perte réelle, quel que soit le moyen de paiement. À défaut, on additionne `fees` et
 * `fixed_commission` (le champ `commission` est un *taux*, ex. `"0.04"`, déjà inclus dans `fees` :
 * ne jamais l'ajouter une seconde fois).
 *
 * Mesuré en sandbox le 06/11/2026 sur une transaction `momo_test` approuvée (2 000 FCFA) :
 * `amount_debited = 2 083`, `fees = 83`, `amount_transferred = 2 000`. Les frais sont donc **ajoutés
 * au montant payé par le client**, pas prélevés sur la recette marchande : la fonction renvoie 0 et le
 * partage se fait sur 2 000 FCFA nets. Si en live le prestataire prélève plutôt les frais sur le
 * montant transféré, la même formule les déduira automatiquement.
 */
export function merchantFee(tx: FedaPayTransaction): number | undefined {
  const amount = Number(tx.amount);
  const transferred = Number(tx.amount_transferred);
  if (Number.isFinite(amount) && Number.isFinite(transferred) && transferred > 0 && transferred <= amount) {
    return Math.max(0, amount - transferred);
  }
  const fees = Number(tx.fees ?? 0);
  const fixed = Number(tx.fixed_commission ?? 0);
  const fallback = (Number.isFinite(fees) ? fees : 0) + (Number.isFinite(fixed) ? fixed : 0);
  return Number.isFinite(amount) && fallback > 0 && fallback <= amount ? Math.round(fallback) : undefined;
}

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

/**
 * Vérifie une commande auprès de l'API et met le registre à jour. Idempotent : le webhook et la page de
 * retour peuvent l'appeler plusieurs fois, `markOrderPaid` ne valide qu'une fois une commande PENDING.
 */
export async function syncFedaPayOrder(order: {
  id: string;
  providerRef: string | null;
  amount: number;
  status: OrderStatus;
}): Promise<OrderStatus> {
  if (!order.providerRef) return order.status;

  let tx: FedaPayTransaction;
  try {
    tx = await getFedaPayTransaction(order.providerRef);
  } catch {
    // Indisponibilité réseau ou référence inconnue : on ne change rien, le webhook réessaiera.
    return order.status;
  }

  // Garde-fou : la transaction doit bien appartenir à cette commande et porter le même montant.
  const metadataRef = tx.custom_metadata?.orderId;
  const ref = tx.merchant_reference ?? (typeof metadataRef === "string" ? metadataRef : null);
  if ((ref && ref !== order.id) || Number(tx.amount) !== order.amount) return order.status;

  const status = String(tx.status).toLowerCase();
  if ((status === "approved" || status === "transferred") && order.status === "PENDING") {
    await markOrderPaid(order.id, order.providerRef, merchantFee(tx));
    return "PAID";
  }
  if ((status === "declined" || status === "canceled" || status === "expired") && order.status === "PENDING") {
    await markOrderFailed(order.id);
    return "FAILED";
  }
  if (status === "refunded" && order.status === "PAID") {
    await markOrderRefunded(order.id);
    return "REFUNDED";
  }
  return order.status;
}
