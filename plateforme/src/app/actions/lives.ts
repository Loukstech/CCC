"use server";

import { revalidatePath } from "next/cache";
import { LIVE_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { isPlaybackId, safeEmbedUrl } from "@/lib/live";

const STATUSES = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"] as const;
const VISIBILITIES = ["PUBLIC", "AUTHENTICATED", "SUBSCRIBERS"] as const;

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** `datetime-local` n'a pas de fuseau : on interprète la saisie comme UTC (serveur Vercel = UTC). */
function parseUtc(raw: string): Date | null {
  const v = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const d = new Date(`${v.length === 16 ? `${v}:00` : v}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const refresh = () => {
  revalidatePath("/admin/lives");
  revalidatePath("/live");
};

/**
 * Programme un événement. Le diffuseur doit porter un badge actif délivré par l'administration :
 * c'est la réponse à la demande client « seuls ceux qui ont une approbation peuvent faire un live ».
 */
export async function createLiveEvent(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(LIVE_ROLES);
  const lang = await getLang();
  const values = keep(formData, [
    "title", "slug", "description", "provider", "embedUrl", "playbackId", "replayUrl",
    "startsAt", "visibility", "status", "broadcasterId",
  ]);
  const title = values.title.trim();
  const slug = slugify(values.slug.trim() || title);
  const provider = values.provider === "MUX" ? "MUX" : "EMBED";
  const status = (STATUSES as readonly string[]).includes(values.status)
    ? (values.status as (typeof STATUSES)[number])
    : "DRAFT";
  const visibility = (VISIBILITIES as readonly string[]).includes(values.visibility)
    ? (values.visibility as (typeof VISIBILITIES)[number])
    : "PUBLIC";
  const startsAt = parseUtc(values.startsAt);
  const broadcasterId = values.broadcasterId.trim() || null;
  const replayUrl = values.replayUrl.trim() || null;

  if (title.length < 3) return { error: t(lang, "liveAdm.errTitle"), values };
  if (!slug) return { error: t(lang, "liveAdm.errSlug"), values };
  if (!startsAt) return { error: t(lang, "liveAdm.errStarts"), values };
  if (await db.liveEvent.findUnique({ where: { slug }, select: { id: true } })) {
    return { error: t(lang, "liveAdm.errSlugTaken"), values };
  }

  let embedUrl: string | null = null;
  let playbackId: string | null = null;
  if (provider === "EMBED") {
    embedUrl = safeEmbedUrl(values.embedUrl);
    if (!embedUrl) return { error: t(lang, "liveAdm.errEmbed"), values };
  } else {
    playbackId = values.playbackId.trim();
    if (!isPlaybackId(playbackId)) return { error: t(lang, "liveAdm.errPlayback"), values };
  }
  if (replayUrl && !safeEmbedUrl(replayUrl)) return { error: t(lang, "liveAdm.errReplay"), values };
  if (broadcasterId) {
    const badge = await db.liveBroadcaster.findUnique({
      where: { userId: broadcasterId },
      select: { revokedAt: true },
    });
    if (!badge || badge.revokedAt) return { error: t(lang, "liveAdm.errBadge"), values };
  }

  const event = await db.liveEvent.create({
    data: {
      slug, title, provider, status, visibility, startsAt,
      description: values.description.trim() || null,
      embedUrl, playbackId, replayUrl: replayUrl ? safeEmbedUrl(replayUrl) : null,
      broadcasterId, createdById: actor.id,
    },
    select: { id: true, slug: true },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id, action: "live.create", target: event.id,
      details: { slug, title, provider, status, visibility, broadcasterId },
    },
  });
  refresh();
  return {
    notice: t(lang, "liveAdm.created", { title, slug }),
    values: { title: "", slug: "", description: "", embedUrl: "", playbackId: "", replayUrl: "", provider, visibility, status },
  };
}

/** Change le statut d'un événement (passer en LIVE, terminer, archiver, remettre en brouillon). */
export async function setLiveStatus(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(LIVE_ROLES);
  const lang = await getLang();
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("status") ?? "");
  if (!id || !(STATUSES as readonly string[]).includes(raw)) {
    return { error: t(lang, "part.errAccount") };
  }
  const status = raw as (typeof STATUSES)[number];
  const event = await db.liveEvent.findUnique({ where: { id }, select: { title: true, status: true } });
  if (!event) return { error: t(lang, "part.errAccount") };

  const data: { status: (typeof STATUSES)[number]; endsAt?: Date } = { status };
  if (raw === "ENDED" && event.status !== "ENDED") data.endsAt = new Date();
  await db.liveEvent.update({ where: { id }, data });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "live.status", target: id, details: { from: event.status, to: status } },
  });
  refresh();
  revalidatePath(`/live/${(await db.liveEvent.findUniqueOrThrow({ where: { id }, select: { slug: true } })).slug}`);
  return { notice: t(lang, "liveAdm.statusChanged", { title: event.title, status: t(lang, `live.status.${status}`) }) };
}

/** Supprime un événement (aucun historique de visionnage n'y est rattaché). */
export async function deleteLiveEvent(formData: FormData) {
  const actor = await requireStaff(LIVE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const event = await db.liveEvent.findUnique({ where: { id }, select: { slug: true, title: true } });
  if (!event) return;
  await db.liveEvent.delete({ where: { id } });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "live.delete", target: id, details: { slug: event.slug, title: event.title } },
  });
  refresh();
}

/** Délivre le badge « diffuseur approuvé » à un compte existant. */
export async function grantLiveBadge(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(LIVE_ROLES);
  const lang = await getLang();
  const values = keep(formData, ["email", "note"]);
  const email = values.email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { error: t(lang, "liveAdm.errUser"), values };

  await db.liveBroadcaster.upsert({
    where: { userId: user.id },
    create: { userId: user.id, grantedById: actor.id, note: values.note.trim() || null },
    update: { revokedAt: null, grantedById: actor.id, note: values.note.trim() || null },
  });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "live.badge.grant", target: user.id, details: { email } },
  });
  refresh();
  return { notice: t(lang, "liveAdm.badgeGranted", { name: user.name ?? email }), values: { email: "", note: "" } };
}

/** Retire le badge : le compte ne peut plus être désigné diffuseur d'un nouvel événement. */
export async function revokeLiveBadge(formData: FormData) {
  const actor = await requireStaff(LIVE_ROLES);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const badge = await db.liveBroadcaster.findUnique({ where: { userId }, select: { revokedAt: true } });
  if (!badge || badge.revokedAt) return;
  await db.liveBroadcaster.update({ where: { userId }, data: { revokedAt: new Date() } });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "live.badge.revoke", target: userId },
  });
  refresh();
}
