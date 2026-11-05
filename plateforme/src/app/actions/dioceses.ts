"use server";

import { revalidatePath } from "next/cache";
import { REFERENTIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { hashPassword } from "@/lib/password";
import { randomBytes } from "node:crypto";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

/** Un slug unique : « diocese-benin », puis « diocese-benin-2 ». */
async function uniqueSlug(name: string): Promise<string> {
  const root = slugify(name) || "diocese";
  let slug = root;
  let n = 1;
  while (await db.diocese.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${root}-${n}`;
  }
  return slug;
}

const refresh = () => {
  revalidatePath("/admin/dioceses");
  revalidatePath("/inscription"); // la liste affichée à l'inscription doit suivre
  revalidatePath("/diocese/inscription");
};

/** Un diocèse peut être renommé et son pays corrigé ; le slug reste stable (liens et historique). */
export async function updateDiocese(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const values = keep(formData, ["id", "name", "country"]);
  const id = values.id;
  const name = values.name.trim();
  const country = values.country.trim().toUpperCase();

  if (!id) return { error: "Diocèse inconnu.", values };
  if (name.length < 3) return { error: "Indiquez le nom du diocèse.", values };
  if (!/^[A-Z]{2}$/.test(country)) return { error: "Code pays invalide (2 lettres, ex. BJ).", values };

  const current = await db.diocese.findUnique({ where: { id }, select: { name: true, country: true } });
  if (!current) return { error: "Diocèse inconnu.", values };

  await db.diocese.update({ where: { id }, data: { name, country } });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "diocese.update",
      target: id,
      details: { from: current, to: { name, country } },
    },
  });
  refresh();
  return { notice: "Diocèse mis à jour." };
}

/**
 * Suppression réelle réservée aux diocèses vides : aucun fidèle rattaché et aucun compte
 * administrateur. Sinon on refuse avec la raison exacte — la désactivation suffit dans ce cas.
 */
export async function deleteDiocese(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Diocèse inconnu." };

  const diocese = await db.diocese.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { parishes: true, admins: true } },
      parishes: { select: { _count: { select: { users: true } } } },
    },
  });
  if (!diocese) return { error: "Diocèse inconnu." };

  const members = diocese.parishes.reduce((n, p) => n + p._count.users, 0);
  if (members > 0) {
    return {
      error: `Suppression impossible : ${members} fidèle(s) sont encore rattaché(s) à ce diocèse. Désactivez-le à la place.`,
    };
  }
  if (diocese._count.admins > 0) {
    return {
      error:
        "Suppression impossible : un compte administrateur gère encore ce diocèse. Supprimez ou désactivez ce compte d'abord.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.parish.deleteMany({ where: { dioceseId: id } });
    await tx.diocese.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "diocese.delete",
        target: id,
        details: { name: diocese.name, parishes: diocese._count.parishes },
      },
    });
  });
  refresh();
  return { notice: `Diocèse « ${diocese.name} » supprimé.` };
}

/**
 * Inscription autonome d'un diocèse : le responsable crée son compte et devient ADMIN de son
 * diocèse. Ouvert sans authentification, mais uniquement si le diocèse n'a pas déjà un ADMIN :
 * sinon n'importe qui pourrait prendre la main sur un espace existant.
 */
export async function registerDioceseAccount(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const values = keep(formData, ["name", "email", "dioceseId"]);
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const dioceseId = values.dioceseId;
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (name.length < 2) return { error: t(lang, "err.name"), values };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t(lang, "err.email"), values };
  if (password.length < 8) return { error: t(lang, "err.pwShort"), values };
  if (password !== passwordConfirm) return { error: t(lang, "err.pwMismatch"), values };
  if (!dioceseId) return { error: t(lang, "dio.errDiocese"), values };

  const diocese = await db.diocese.findFirst({
    where: { id: dioceseId, active: true },
    select: { id: true, name: true, admins: { where: { role: "ADMIN" }, select: { userId: true }, take: 1 } },
  });
  if (!diocese) return { error: t(lang, "dio.errDiocese"), values };
  if (diocese.admins.length > 0) return { error: t(lang, "dio.errTaken"), values };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: t(lang, "err.exists"), values };

  await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        locale: lang,
        dioceseAdmins: { create: { dioceseId: diocese.id, role: "ADMIN" } },
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: created.id,
        action: "dioceseAdmin.selfRegister",
        target: created.id,
        details: { email, name, dioceseId: diocese.id },
      },
    });
  });

  refresh();
  return { notice: t(lang, "dio.created", { diocese: diocese.name }) };
}


export async function createDiocese(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const values = keep(formData, ["name", "country"]);
  const name = values.name.trim();
  const country = values.country.trim().toUpperCase();

  if (name.length < 3) return { error: "Indiquez le nom du diocèse.", values };
  if (!/^[A-Z]{2}$/.test(country)) return { error: "Code pays invalide (2 lettres, ex. BJ).", values };

  const d = await db.diocese.create({
    data: { name, country, slug: await uniqueSlug(name) },
    select: { id: true },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "diocese.create", target: d.id, details: { name, country } },
  });
  refresh();
  return undefined;
}

export async function createParish(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const values = keep(formData, ["dioceseId", "name", "city"]);
  const name = values.name.trim();
  const city = values.city.trim();

  if (!values.dioceseId) return { error: "Choisissez le diocèse.", values };
  if (name.length < 3) return { error: "Indiquez le nom de la paroisse.", values };

  const diocese = await db.diocese.findUnique({ where: { id: values.dioceseId }, select: { id: true } });
  if (!diocese) return { error: "Diocèse inconnu.", values };

  const exists = await db.parish.findFirst({ where: { dioceseId: diocese.id, name }, select: { id: true } });
  if (exists) return { error: "Une paroisse porte déjà ce nom dans ce diocèse.", values };

  const p = await db.parish.create({
    data: { dioceseId: diocese.id, name, city: city || null },
    select: { id: true },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "parish.create", target: p.id, details: { dioceseId: diocese.id, name, city } },
  });
  refresh();
  return undefined;
}

export async function renameParish(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const values = keep(formData, ["id", "name", "city"]);
  const id = values.id;
  const name = values.name.trim();
  const city = values.city.trim();

  if (!id) return { error: "Paroisse inconnue.", values };
  if (name.length < 3) return { error: "Indiquez le nom de la paroisse.", values };

  const current = await db.parish.findUnique({ where: { id }, select: { dioceseId: true, name: true, city: true } });
  if (!current) return { error: "Paroisse inconnue.", values };

  const clash = await db.parish.findFirst({
    where: { dioceseId: current.dioceseId, name, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: "Une autre paroisse porte déjà ce nom dans ce diocèse.", values };

  await db.parish.update({ where: { id }, data: { name, city: city || null } });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "parish.rename",
      target: id,
      details: { from: { name: current.name, city: current.city }, to: { name, city: city || null } },
    },
  });
  refresh();
  return undefined;
}

export async function toggleParish(formData: FormData) {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const current = await db.parish.findUnique({ where: { id }, select: { active: true, mergedIntoId: true } });
  if (!current) return;
  // Une paroisse fusionnée ne se réactive pas : elle resterait rattachée à une autre.
  if (current.mergedIntoId) return;

  const active = !current.active;
  await db.parish.update({ where: { id }, data: { active } });
  await db.auditLog.create({ data: { actorId: user.id, action: "parish.toggle", target: id, details: { active } } });
  refresh();
}

export async function toggleDiocese(formData: FormData) {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const current = await db.diocese.findUnique({ where: { id }, select: { active: true } });
  if (!current) return;

  const active = !current.active;
  await db.diocese.update({ where: { id }, data: { active } });
  await db.auditLog.create({ data: { actorId: user.id, action: "diocese.toggle", target: id, details: { active } } });
  refresh();
}

/**
 * Fusionne une paroisse dans une autre du même diocèse : les fidèles sont réaffectés, la paroisse
 * source est désactivée et reliée à sa cible. Aucune suppression, conformément à la réponse client,
 * afin que l'historique des commissions reste lisible.
 */
export async function mergeParish(formData: FormData) {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const id = String(formData.get("id") ?? "");
  const intoId = String(formData.get("intoId") ?? "");
  if (!id || !intoId || id === intoId) return;

  const [source, target] = await Promise.all([
    db.parish.findUnique({ where: { id }, select: { id: true, dioceseId: true } }),
    db.parish.findUnique({ where: { id: intoId }, select: { id: true, dioceseId: true, active: true } }),
  ]);
  // Une fusion n'a de sens qu'entre paroisses actives d'un même diocèse.
  if (!source || !target || !target.active || source.dioceseId !== target.dioceseId) return;

  const moved = await db.$transaction(async (tx) => {
    const res = await tx.user.updateMany({ where: { parishId: id }, data: { parishId: intoId } });
    await tx.parish.update({ where: { id }, data: { active: false, mergedIntoId: intoId } });
    return res.count;
  });

  await db.auditLog.create({
    data: { actorId: user.id, action: "parish.merge", target: id, details: { intoId, moved } },
  });
  refresh();
}

/** Génère un mot de passe provisoire lisible (ex. « X7k9-Pq2m »). */
function generateTempPassword(): string {
  const bytes = randomBytes(6);
  const s = bytes.toString("base64url").slice(0, 8);
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Crée un administrateur diocésain. Le mot de passe provisoire est affiché une seule fois, à copier. */
export async function createDioceseAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const values = keep(formData, ["email", "name", "dioceseId", "role"]);
  const email = values.email.trim().toLowerCase();
  const name = values.name.trim();
  const dioceseId = values.dioceseId;
  const role = values.role === "VIEWER" ? "VIEWER" : "ADMIN";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email invalide.", values };
  if (name.length < 2) return { error: "Indiquez le nom.", values };
  if (!dioceseId) return { error: "Choisissez le diocèse.", values };

  const diocese = await db.diocese.findUnique({ where: { id: dioceseId }, select: { id: true, name: true } });
  if (!diocese) return { error: "Diocèse inconnu.", values };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "Cet email est déjà utilisé.", values };

  const tempPassword = generateTempPassword();

  // Aucun rôle de personnel n'est accordé : un administrateur de diocèse ne doit pas entrer dans la
  // modération ni dans les autres écrans d'administration. Son périmètre vient de DioceseAdmin.
  const passwordHash = await hashPassword(tempPassword);
  await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        dioceseAdmins: { create: { dioceseId: diocese.id, role } },
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "dioceseAdmin.create",
        target: created.id,
        details: { email, name, dioceseId: diocese.id, role },
      },
    });
  });

  refresh();
  return {
    notice: `Compte créé pour ${name} (${diocese.name}, ${role === "ADMIN" ? "administrateur" : "observateur"}).\nMot de passe provisoire : ${tempPassword}\nCommuniquez-le de vive voix : il ne sera plus affiché.`,
    values: { email: "", name: "", dioceseId, role },
  };
}
