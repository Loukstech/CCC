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
 */
export async function POST(request: Request) {
  let event: { name?: unknown; object?: Record<string, unknown> };
  try {
    event = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const name = typeof event.name === "string" ? event.name : "";
  const object = event.object ?? {};
  if (!name.startsWith("transaction.")) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const metadata = object.custom_metadata as Record<string, unknown> | undefined;
  const orderId =
    (typeof object.merchant_reference === "string" && object.merchant_reference) ||
    (typeof metadata?.orderId === "string" ? metadata.orderId : null);
  if (!orderId) return NextResponse.json({ received: true, ignored: true });

  const order = await db.order.findFirst({
    where: { id: orderId, provider: "fedapay" },
    select: { id: true, providerRef: true, amount: true, status: true },
  });
  if (!order) return NextResponse.json({ received: true, ignored: true });

  try {
    await syncFedaPayOrder(order);
  } catch {
    // Réponse non-2xx : FedaPay réessaiera (jusqu'à 9 fois). Le traitement est idempotent.
    return NextResponse.json({ error: "Traitement impossible" }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}
