"use server";

import { revalidatePath } from "next/cache";
import { REFERENTIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { hashPassword } from "@/lib/password";
import {
  claimableWhere,
  codeError,
  inspectCode,
  normalizeCode,
  partnerCodesRequired,
} from "@/lib/partner-codes";
import { getBool } from "@/lib/settings";
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
  const lang = await getLang();
  const values = keep(formData, ["id", "name", "country"]);
  const id = values.id;
  const name = values.name.trim();
  const country = values.country.trim().toUpperCase();

  if (!id) return { error: t(lang, "dioAdm.errDiocese"), values };
  if (name.length < 3) return { error: t(lang, "dioAdm.errName"), values };
  if (!/^[A-Z]{2}$/.test(country)) return { error: t(lang, "dioAdm.errCountry"), values };

  const current = await db.diocese.findUnique({ where: { id }, select: { name: true, country: true } });
  if (!current) return { error: t(lang, "dioAdm.errDiocese"), values };

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
  return { notice: t(lang, "dioAdm.updated") };
}

/**
 * Suppression réelle réservée aux diocèses vides : aucun fidèle rattaché et aucun compte
 * administrateur. Sinon on refuse avec la raison exacte — la désactivation suffit dans ce cas.
 */
export async function deleteDiocese(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t(lang, "dioAdm.errDiocese") };

  const diocese = await db.diocese.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { parishes: true, admins: true } },
      parishes: { select: { _count: { select: { users: true } } } },
    },
  });
  if (!diocese) return { error: t(lang, "dioAdm.errDiocese") };

  const members = diocese.parishes.reduce((n, p) => n + p._count.users, 0);
  if (members > 0) {
    return { error: t(lang, "dioAdm.errDeleteMembers", { n: members }) };
  }
  if (diocese._count.admins > 0) {
    return { error: t(lang, "dioAdm.errDeleteAdmins") };
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
  return { notice: t(lang, "dioAdm.deleted", { name: diocese.name }) };
}

/**
 * Inscription autonome d'un diocèse : le responsable crée son compte et devient ADMIN de son
 * diocèse. Ouvert sans authentification, mais uniquement si le diocèse n'a pas déjà un ADMIN :
 * sinon n'importe qui pourrait prendre la main sur un espace existant.
 */
export async function registerDioceseAccount(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  if (await getBool("maintenance_mode")) return { error: t(lang, "err.maintenance") };
  const values = keep(formData, ["name", "email", "dioceseId"]);
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const dioceseId = values.dioceseId;
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  // Jamais renvoyé dans `values` : un code ne doit pas être réaffiché dans le formulaire.
  const partnerCode = normalizeCode(String(formData.get("partnerCode") ?? ""));

  if (name.length < 2) return { error: t(lang, "err.name"), values };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t(lang, "err.email"), values };
  if (password.length < 8) return { error: t(lang, "err.pwShort"), values };
  if (password !== passwordConfirm) return { error: t(lang, "err.pwMismatch"), values };
  if (!dioceseId) return { error: t(lang, "dio.errDiocese"), values };

  // Lot 8 : un code de partenariat signé remplace l'auto-inscription libre. Le contrôle est
  // activé par PARTNER_CODE_REQUIRED ; un code saisi est toujours vérifié, même si le flag est off.
  const gated = partnerCodesRequired();
  let code: Awaited<ReturnType<typeof inspectCode>> = { ok: false, reason: "invalid" };
  if (gated || partnerCode) {
    code = await inspectCode(partnerCode, "DIOCESE", dioceseId);
    if (!code.ok) return { error: codeError(lang, code.reason), values };
  }

  const diocese = await db.diocese.findFirst({
    where: { id: dioceseId, active: true },
    select: { id: true, name: true, admins: { where: { role: "ADMIN" }, select: { userId: true }, take: 1 } },
  });
  if (!diocese) return { error: t(lang, "dio.errDiocese"), values };
  // Sans code, on garde la protection anti-usurpation. Avec un code valide (preuve du contrat),
  // l'administration peut ajouter un second responsable au même diocèse.
  if (diocese.admins.length > 0 && !code.ok) return { error: t(lang, "dio.errTaken"), values };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: t(lang, "err.exists"), values };

  try {
    await db.$transaction(async (tx) => {
      if (code.ok) {
        const claim = await tx.partnerCode.updateMany({
          where: claimableWhere(partnerCode, "DIOCESE", diocese.id),
          data: { usedAt: new Date() },
        });
        if (claim.count !== 1) throw new Error("CODE_CLAIM_FAILED");
      }
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
      if (code.ok) {
        await tx.partnerCode.update({ where: { id: code.id }, data: { usedByUserId: created.id } });
      }
      await tx.auditLog.create({
        data: {
          actorId: created.id,
          action: "dioceseAdmin.selfRegister",
          target: created.id,
          details: { email, name, dioceseId: diocese.id, partnerCode: code.ok ? code.id : null },
        },
      });
    });
  } catch (e) {
    // Transaction annulée : le code n'est pas consumé, le compte n'est pas créé.
    if (e instanceof Error && e.message === "CODE_CLAIM_FAILED") {
      return { error: codeError(lang, "used"), values };
    }
    throw e;
  }

  refresh();
  return { notice: t(lang, "dio.created", { diocese: diocese.name }) };
}


export async function createDiocese(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const values = keep(formData, ["name", "country"]);
  const name = values.name.trim();
  const country = values.country.trim().toUpperCase();

  if (name.length < 3) return { error: t(lang, "dioAdm.errName"), values };
  if (!/^[A-Z]{2}$/.test(country)) return { error: t(lang, "dioAdm.errCountry"), values };

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
  const lang = await getLang();
  const values = keep(formData, ["dioceseId", "name", "city"]);
  const name = values.name.trim();
  const city = values.city.trim();

  if (!values.dioceseId) return { error: t(lang, "dioAdm.errChooseDiocese"), values };
  if (name.length < 3) return { error: t(lang, "dioAdm.errParishName"), values };

  const diocese = await db.diocese.findUnique({ where: { id: values.dioceseId }, select: { id: true } });
  if (!diocese) return { error: t(lang, "dioAdm.errDiocese"), values };

  const exists = await db.parish.findFirst({ where: { dioceseId: diocese.id, name }, select: { id: true } });
  if (exists) return { error: t(lang, "dioAdm.errParishExists"), values };

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
  const lang = await getLang();
  const values = keep(formData, ["id", "name", "city"]);
  const id = values.id;
  const name = values.name.trim();
  const city = values.city.trim();

  if (!id) return { error: t(lang, "dioAdm.errParish"), values };
  if (name.length < 3) return { error: t(lang, "dioAdm.errParishName"), values };

  const current = await db.parish.findUnique({ where: { id }, select: { dioceseId: true, name: true, city: true } });
  if (!current) return { error: t(lang, "dioAdm.errParish"), values };

  const clash = await db.parish.findFirst({
    where: { dioceseId: current.dioceseId, name, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: t(lang, "dioAdm.errParishClash"), values };

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

// Alphabet sans I, O, 0 et 1 : un mot de passe dicté au téléphone ne se confond pas.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Génère un mot de passe provisoire lisible (ex. « X7K9-PQ2M »). */
function generateTempPassword(): string {
  const chars = Array.from(randomBytes(8), (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/**
 * Nombre d'administrateurs réellement actifs d'un diocèse, en excluant éventuellement un compte.
 * Un diocèse sans administrateur actif ne peut plus être géré ni réclamé : on s'en sert comme garde-fou
 * avant toute rétrogradation ou désactivation.
 */
async function activeAdminCount(dioceseId: string, exceptUserId?: string): Promise<number> {
  return db.dioceseAdmin.count({
    where: {
      dioceseId,
      role: "ADMIN",
      ...(exceptUserId ? { userId: { not: exceptUserId } } : {}),
      user: { disabledAt: null },
    },
  });
}

/** Change le rôle d'un compte diocésain. On refuse de retirer le dernier administrateur actif. */
export async function updateDioceseAdminRole(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role") === "VIEWER" ? "VIEWER" : "ADMIN";
  if (!userId) return { error: t(lang, "dioAdm.errAccount") };

  const membership = await db.dioceseAdmin.findFirst({
    where: { userId },
    select: { dioceseId: true, role: true, user: { select: { name: true, email: true } } },
  });
  if (!membership) return { error: t(lang, "dioAdm.errNoMembership") };
  if (membership.role === role) return { notice: t(lang, "dioAdm.roleUnchanged") };

  if (role === "VIEWER" && (await activeAdminCount(membership.dioceseId, userId)) === 0) {
    return { error: t(lang, "dioAdm.errLastAdminDemote") };
  }

  await db.dioceseAdmin.updateMany({ where: { userId, dioceseId: membership.dioceseId }, data: { role } });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "dioceseAdmin.role",
      target: userId,
      details: { dioceseId: membership.dioceseId, from: membership.role, to: role },
    },
  });
  refresh();
  return {
    notice: t(lang, "dioAdm.roleChanged", {
      name: membership.user.name ?? membership.user.email ?? t(lang, "dioAdm.thisAccount"),
      role: role === "ADMIN" ? t(lang, "dioAdm.roleAdminWord") : t(lang, "dioAdm.roleViewerWord"),
    }),
  };
}

/**
 * Désactive ou réactive un compte diocésain. La désactivation coupe l'accès immédiatement
 * (getCurrentUser traite un compte désactivé comme déconnecté) sans toucher aux fidèles ni au diocèse.
 */
export async function toggleDioceseAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: t(lang, "dioAdm.errAccount") };

  const membership = await db.dioceseAdmin.findFirst({
    where: { userId },
    select: {
      dioceseId: true,
      role: true,
      user: { select: { name: true, email: true, disabledAt: true, staffRole: true } },
    },
  });
  if (!membership) return { error: t(lang, "dioAdm.errNoMembership") };
  if (membership.user.staffRole) {
    return { error: t(lang, "dioAdm.errStaff") };
  }

  const disable = !membership.user.disabledAt;
  if (disable && membership.role === "ADMIN" && (await activeAdminCount(membership.dioceseId, userId)) === 0) {
    return { error: t(lang, "dioAdm.errLastAdminDisable") };
  }

  await db.user.update({ where: { id: userId }, data: { disabledAt: disable ? new Date() : null } });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: disable ? "dioceseAdmin.disable" : "dioceseAdmin.enable",
      target: userId,
      details: { dioceseId: membership.dioceseId },
    },
  });
  refresh();
  return {
    notice: t(lang, disable ? "dioAdm.accountDisabled" : "dioAdm.accountEnabled", {
      name: membership.user.name ?? membership.user.email ?? t(lang, "dioAdm.theAdministrator"),
    }),
  };
}

/** Réinitialise le mot de passe d'un compte diocésain. Le provisoire n'est affiché qu'une seule fois. */
export async function resetDioceseAdminPassword(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: t(lang, "dioAdm.errAccount") };

  const membership = await db.dioceseAdmin.findFirst({
    where: { userId },
    select: { dioceseId: true, user: { select: { name: true, email: true, disabledAt: true } } },
  });
  if (!membership) return { error: t(lang, "dioAdm.errNoMembership") };
  if (membership.user.disabledAt) {
    return { error: t(lang, "dioAdm.errDisabledReset") };
  }

  const tempPassword = generateTempPassword();
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(tempPassword) } });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "dioceseAdmin.resetPassword",
      target: userId,
      details: { dioceseId: membership.dioceseId },
    },
  });
  refresh();
  return {
    notice: t(lang, "dioAdm.pwReset", {
      name: membership.user.name ?? membership.user.email ?? t(lang, "dioAdm.thisAccount"),
      password: tempPassword,
    }),
  };
}

/** Crée un administrateur diocésain. Le mot de passe provisoire est affiché une seule fois, à copier. */
export async function createDioceseAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();
  const values = keep(formData, ["email", "name", "dioceseId", "role"]);
  const email = values.email.trim().toLowerCase();
  const name = values.name.trim();
  const dioceseId = values.dioceseId;
  const role = values.role === "VIEWER" ? "VIEWER" : "ADMIN";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t(lang, "dioAdm.errEmail"), values };
  if (name.length < 2) return { error: t(lang, "dioAdm.errNameShort"), values };
  if (!dioceseId) return { error: t(lang, "dioAdm.errChooseDiocese"), values };

  const diocese = await db.diocese.findUnique({ where: { id: dioceseId }, select: { id: true, name: true } });
  if (!diocese) return { error: t(lang, "dioAdm.errDiocese"), values };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: t(lang, "dioAdm.errEmailTaken"), values };

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
    notice: t(lang, "dioAdm.created", {
      name,
      diocese: diocese.name,
      role: role === "ADMIN" ? t(lang, "dioAdm.roleAdminWord") : t(lang, "dioAdm.roleViewerWord"),
      password: tempPassword,
    }),
    values: { email: "", name: "", dioceseId, role },
  };
}
