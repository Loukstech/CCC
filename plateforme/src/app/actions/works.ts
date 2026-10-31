"use server";

import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { CATALOG_ROLES, requireStaff } from "@/lib/dal";
import { WORKS_TAG } from "@/lib/catalog";
import { keep, type FormState } from "@/lib/form";

const TYPES = ["BOOK", "FILM", "DOCUMENTARY"] as const;
const ACCESS = ["FREE", "PURCHASE", "SUBSCRIPTION"] as const;

function slugify(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseCountries(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export async function createWork(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(CATALOG_ROLES);

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const access = String(formData.get("access") ?? "");
  const author = String(formData.get("author") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const language = String(formData.get("language") ?? "fr").trim().toLowerCase() || "fr";
  const priceRaw = String(formData.get("price") ?? "").trim();
  const countries = parseCountries(String(formData.get("countries") ?? ""));
  const contractRef = String(formData.get("contractRef") ?? "").trim() || null;
  const allowOffline = formData.get("allowOffline") === "on";
  const publish = formData.get("publish") === "on";
  const values = keep(formData, ["title", "type", "author", "description", "language", "access", "price", "countries", "contractRef", "allowOffline", "publish"]);

  if (title.length < 2) return { error: "Indiquez le titre de l’œuvre.", values };
  if (!(TYPES as readonly string[]).includes(type)) return { error: "Type d’œuvre invalide.", values };
  if (!(ACCESS as readonly string[]).includes(access)) return { error: "Mode d’accès invalide.", values };
  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
    return { error: "Les pays doivent être des codes à 2 lettres séparés par des virgules (ex. BJ, TG, FR).", values };
  }

  let price: number | null = null;
  if (access === "PURCHASE") {
    price = Number(priceRaw);
    if (!Number.isInteger(price) || price <= 0) {
      return { error: "Indiquez le prix en F CFA (nombre entier positif).", values };
    }
  }

  // Règle du cahier des charges : aucune publication sans droits documentés (section 17).
  if (publish && (countries.length === 0 || !contractRef)) {
    return {
      error:
        "Pour publier, renseignez au moins un pays autorisé et la référence du contrat de licence. Sinon, enregistrez en brouillon.",
      values,
    };
  }

  const base = slugify(title) || "oeuvre";
  const taken = await db.work.findUnique({ where: { slug: base }, select: { id: true } });
  const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;

  const work = await db.work.create({
    data: {
      slug,
      title,
      type: type as (typeof TYPES)[number],
      access: access as (typeof ACCESS)[number],
      author,
      description,
      language,
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
      downloadable: allowOffline,
      ...(price !== null && {
        prices: { create: { country: "BJ", currency: "XOF", amount: price } },
      }),
      licenses: {
        create: { countries, allowOffline, contractRef },
      },
    },
    select: { id: true },
  });

  await db.auditLog.create({
    data: { actorId: user.id, action: "work.create", target: work.id, details: { title, publish } },
  });
  updateTag(WORKS_TAG);
  revalidatePath("/admin");
  return undefined;
}

export async function setWorkStatus(formData: FormData) {
  const user = await requireStaff(CATALOG_ROLES);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "PUBLISHED" && status !== "DRAFT" && status !== "ARCHIVED")) return;

  if (status === "PUBLISHED") {
    const licenses = await db.license.findMany({ where: { workId: id }, select: { countries: true, contractRef: true } });
    const documented = licenses.some((l) => l.countries.length > 0 && l.contractRef);
    if (!documented) return; // droits non documentés : on ne publie pas
  }

  await db.work.update({
    where: { id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.status", target: id, details: { status } },
  });
  updateTag(WORKS_TAG);
  revalidatePath("/admin");
}
