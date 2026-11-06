"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownsWork } from "@/lib/access";
import { priceFor } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { markOrderFailed, markOrderPaid } from "@/lib/payments/fulfill";
import { demoCheckoutVisible, getPaymentProvider, providerCharge } from "@/lib/payments";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { isPlan, planPriceFor } from "@/lib/plans";
import { getCountry, isAvailable } from "@/lib/rights";

/** Achat d'une œuvre à l'unité : crée la commande « en attente », puis envoie vers la page de paiement. */
export async function startPurchase(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const workId = String(formData.get("workId") ?? "");
  const work = await db.work.findFirst({
    where: { id: workId, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      access: true,
      prices: { select: { country: true, currency: true, amount: true } },
      licenses: { select: { countries: true, allowWeb: true, startsAt: true, endsAt: true } },
    },
  });
  if (!work || work.access !== "PURCHASE") return;

  // Toutes les règles sont revérifiées ici : pays autorisé, pas déjà acheté, prix défini.
  const country = await getCountry(user);
  if (!country || !isAvailable(work.licenses, country, new Date())) redirect(`/oeuvres/${work.slug}`);
  if (await ownsWork(user.id, work.id)) redirect(`/oeuvres/${work.slug}`);
  const price = priceFor(work.prices, country);
  if (!price) redirect(`/oeuvres/${work.slug}`);

  const provider = getPaymentProvider();
  // Aucun prestataire réel branché : on ne crée pas de commande et on l'annonce clairement.
  if (provider.id === "demo" && !demoCheckoutVisible) redirect("/paiement/indisponible");
  // FedaPay n'encaisse qu'en XOF : la commande est créée dans la devise réellement facturée.
  const charge = providerCharge(provider.id, price);
  const order = await db.order.create({
    data: { userId: user.id, workId: work.id, currency: charge.currency, amount: charge.amount, provider: provider.id },
    select: { id: true },
  });
  const checkout = await provider.createCheckout({
    orderId: order.id,
    amount: charge.amount,
    currency: charge.currency,
    description: work.title,
    customer: { name: user.name, email: user.email },
  });
  await db.order.update({ where: { id: order.id }, data: { providerRef: checkout.providerRef } });
  redirect(checkout.redirectUrl);
}

/** Abonnement mensuel ou annuel : une commande « en attente » sans œuvre, avec la formule choisie. */
export async function startSubscription(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const lang = await getLang();
  const plan = formData.get("plan");
  if (!isPlan(plan)) return;
  const country = await getCountry(user);
  const price = await planPriceFor(plan, country);
  if (!price) redirect("/abonnement");

  const provider = getPaymentProvider();
  if (provider.id === "demo" && !demoCheckoutVisible) redirect("/paiement/indisponible");
  const charge = providerCharge(provider.id, price);
  const order = await db.order.create({
    data: { userId: user.id, plan, currency: charge.currency, amount: charge.amount, provider: provider.id },
    select: { id: true },
  });
  const checkout = await provider.createCheckout({
    orderId: order.id,
    amount: charge.amount,
    currency: charge.currency,
    description: t(lang, "pay.subDescription", { plan: t(lang, `sub.planLower.${plan}`) }),
    customer: { name: user.name, email: user.email },
  });
  await db.order.update({ where: { id: order.id }, data: { providerRef: checkout.providerRef } });
  redirect(checkout.redirectUrl);
}

/** Page de paiement de démonstration : l'utilisateur simule un paiement réussi ou un échec. */
export async function completeDemoPayment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  // Le faux paiement n'est utilisable que si on l'a explicitement ouvert (recette technique).
  if (!demoCheckoutVisible) redirect("/paiement/indisponible");

  const orderId = String(formData.get("orderId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  // Seules ses propres commandes « en attente » passées par le prestataire de démonstration.
  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id, provider: "demo", status: "PENDING" },
    select: { id: true },
  });
  if (order) {
    if (outcome === "paid") await markOrderPaid(order.id, `demo_paid_${order.id}`);
    else await markOrderFailed(order.id);
  }
  revalidatePath("/compte");
  revalidatePath("/bibliotheque");
  redirect(`/paiement/retour?order=${encodeURIComponent(orderId)}`);
}

/** Résiliation : l'accès reste valable jusqu'à la fin de la période déjà payée. */
export async function cancelSubscription() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  await db.subscription.updateMany({
    where: { userId: user.id, status: "ACTIVE", endsAt: { gt: new Date() } },
    data: { status: "CANCELED" },
  });
  revalidatePath("/compte");
  revalidatePath("/abonnement");
}
