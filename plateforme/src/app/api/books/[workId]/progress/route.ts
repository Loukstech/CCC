import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { authorizeRead } from "@/lib/reading";

/** Enregistre la position de lecture (repère exact + pourcentage) pour reprendre sur n'importe quel appareil. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[workId]/progress">) {
  // Seul un corps JSON est accepté : un formulaire venu d'un autre site ne peut pas l'envoyer.
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return new Response("Format invalide.", { status: 415 });
  }
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });

  const { workId } = await ctx.params;
  const access = await authorizeRead(user, { id: workId });
  if (!access.ok) return new Response("Accès refusé.", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Format invalide.", { status: 400 });
  }
  const { locator, percent } = (body ?? {}) as { locator?: unknown; percent?: unknown };
  if (typeof locator !== "string" || locator.length === 0 || locator.length > 600) {
    return new Response("Position invalide.", { status: 400 });
  }
  const position = typeof percent === "number" && Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;

  await db.progress.upsert({
    where: { userId_workId: { userId: user.id, workId: access.work.id } },
    update: { position, locator },
    create: { userId: user.id, workId: access.work.id, position, locator },
  });
  return new Response(null, { status: 204 });
}
