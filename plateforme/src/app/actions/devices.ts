"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { clearDeviceCookie, registerDevice } from "@/lib/devices";
import { createSession, deleteSession } from "@/lib/session";

/**
 * Retire un appareil du compte. Si l'appareil courant n'était pas encore autorisé (limite atteinte),
 * il est enregistré dans la foulée : parcours « téléphone changé » du cahier des charges (annexe B).
 */
export async function revokeDevice(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const id = String(formData.get("deviceId") ?? "");
  // Filtré par compte : on ne peut retirer que ses propres appareils.
  const res = await db.device.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) return;

  if (id === user.deviceId) {
    // On vient de retirer l'appareil que l'on utilise : fin de session ici.
    await deleteSession();
    await clearDeviceCookie();
    redirect("/connexion");
  }

  if (!user.deviceOk) {
    const device = await registerDevice(user.id);
    if (device.ok) await createSession(user.id, device.deviceId);
  }
  revalidatePath("/compte");
  redirect("/compte");
}

/** Autorise l'appareil courant s'il reste une place (sessions ouvertes avant l'arrivée de la limite d'appareils). */
export async function authorizeThisDevice() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.deviceOk) {
    const device = await registerDevice(user.id);
    if (device.ok) await createSession(user.id, device.deviceId);
  }
  revalidatePath("/compte");
  redirect("/compte");
}
