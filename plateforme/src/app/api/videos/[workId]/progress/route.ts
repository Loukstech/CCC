import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { authorizeWatch } from "@/lib/reading";

const MAX_SECONDS = 24 * 60 * 60;

/**
 * Enregistre la position de visionnage : `position` en secondes, et la durée de la vidéo dans `locator`
 * (pour calculer le pourcentage). Même contrôle d'accès que la lecture.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/videos/[workId]/progress">) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return new Response("Format invalide.", { status: 415 });
  }
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });

  const { workId } = await ctx.params;
  const access = await authorizeWatch(user, { id: workId });
  if (!access.ok) return new Response("Accès refusé.", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Format invalide.", { status: 400 });
  }
  const { position, duration } = (body ?? {}) as { position?: unknown; duration?: unknown };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const pos = num(position);
  const dur = num(duration);
  if (!(pos >= 0) || pos > MAX_SECONDS || !(dur > 0) || dur > MAX_SECONDS) {
    return new Response("Position invalide.", { status: 400 });
  }

  const data = { position: Math.min(pos, dur), locator: String(Math.round(dur)) };
  await db.progress.upsert({
    where: { userId_workId: { userId: user.id, workId: access.work.id } },
    update: data,
    create: { userId: user.id, workId: access.work.id, ...data },
  });
  return new Response(null, { status: 204 });
}
