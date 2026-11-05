"use server";

import { revalidatePath } from "next/cache";
import { EDITORIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";

const STATUSES = ["REVIEWING", "ACCEPTED", "REJECTED"] as const;

/** Décision du comité éditorial sur un manuscrit déposé. */
export async function reviewManuscript(formData: FormData) {
  await requireStaff(EDITORIAL_ROLES);
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id || !(STATUSES as readonly string[]).includes(raw)) return;

  await db.manuscript.update({
    where: { id },
    data: { status: raw as (typeof STATUSES)[number], reviewerNote: note },
  });
  revalidatePath("/admin/manuscrits");
  revalidatePath("/ecrivain");
}
