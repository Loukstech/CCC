import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncFedaPayOrder } from "@/lib/payments/fedapay";

/**
 * Webhook FedaPay : POST /api/payments/fedapay/webhook
 *
 * À déclarer dans Workbench → Webhooks, en ne sélectionnant que :
 *   transaction.approved, transaction.declined, transaction.canceled, transaction.refunded
 *
 * Sécurité : le corps n'est jamais cru sur parole. Chaque événement déclenche une relecture de la
 * transaction via l'API authentifiée (voir syncFedaPayOrder) ; un webhook forgé ne peut donc pas
 * valider une commande impayée. La vérification de l'en-tête X-FEDAPAY-SIGNATURE par la bibliothèque
 * officielle reste à ajouter avant le passage en live (la doc ne documente pas l'algorithme manuel).
 *
 * Idempotence : markOrderPaid ne fait passer qu'une fois PENDING → PAID, les écritures du registre
 * portent des clés uniques, et un événement rejoué reçoit quand même un 2xx pour éviter les relances.
 *
 * Forme du payload : la doc officielle montre `event.name` et `event.object`, mais l'API
 * `/v1/events` renvoie `type` + `entity` (une **chaîne JSON**). On tolère donc les deux, ainsi que
 * `data.object`, un objet sérialisé, et une recherche par identifiant de transaction FedaPay.
 * Sans cette tolérance, un événement parfaitement valable peut être ignoré en silence.
 */

type Obj = Record<string, unknown>;

/** Accepte un objet OU une chaîne JSON (FedaPay sérialise parfois `entity` / `object`). */
function asObject(value: unknown): Obj {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Obj;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Obj;
    } catch {
      // Chaîne non JSON : ignorée.
    }
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

const ignored = (reason: string) =>
  NextResponse.json({ received: true, ignored: true, reason });

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const event = asObject(parsedBody);
  const name = asString(event.name) ?? asString(event.type) ?? "";
  if (!name.startsWith("transaction.")) return ignored("event-type");

  const data = asObject(event.data);
  const object = asObject(event.object ?? event.entity ?? data.object ?? data.entity);
  const metadata = asObject(object.custom_metadata ?? object.metadata);

  // Référence de notre commande, ou à défaut l'identifiant de la transaction FedaPay.
  const orderId =
    asString(object.merchant_reference) ??
    asString(metadata.orderId) ??
    asString(event.merchant_reference) ??
    null;
  const txId = asString(object.id) ?? asString(event.object_id) ?? null;

  const or: { id?: string; provider: "fedapay"; providerRef?: string }[] = [];
  if (orderId) or.push({ id: orderId, provider: "fedapay" });
  if (txId) or.push({ provider: "fedapay", providerRef: txId });
  if (or.length === 0) return ignored("no-reference");

  const order = await db.order.findFirst({
    where: { OR: or },
    select: { id: true, providerRef: true, amount: true, status: true },
  });
  if (!order) return ignored("unknown-order");

  try {
    await syncFedaPayOrder(order);
  } catch {
    // Réponse non-2xx : FedaPay réessaiera (jusqu'à 9 fois). Le traitement est idempotent.
    return NextResponse.json({ error: "Traitement impossible" }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
