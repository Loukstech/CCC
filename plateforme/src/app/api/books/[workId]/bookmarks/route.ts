import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { authorizeRead } from "@/lib/reading";

const MAX_PER_BOOK = 200;
const select = { id: true, locator: true, label: true, percent: true } as const;

type Ctx = RouteContext<"/api/books/[workId]/bookmarks">;

/** Vérifie compte, bibliothèque et pays : les signets suivent exactement les droits de lecture. */
async function authorize(ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return { error: new Response("Connexion requise.", { status: 401 }) } as const;
  const { workId } = await ctx.params;
  const access = await authorizeRead(user, { id: workId });
  if (!access.ok) return { error: new Response("Accès refusé.", { status: 403 }) } as const;
  return { user, workId: access.work.id } as const;
}

const isJson = (req: Request) => !!req.headers.get("content-type")?.includes("application/json");

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await authorize(ctx);
  if ("error" in auth) return auth.error;
  const items = await db.bookmark.findMany({
    where: { userId: auth.user.id, workId: auth.workId },
    orderBy: { percent: "asc" },
    select,
  });
  return Response.json(items, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request, ctx: Ctx) {
  if (!isJson(req)) return new Response("Format invalide.", { status: 415 });
  const auth = await authorize(ctx);
  if ("error" in auth) return auth.error;

  const body = await readBody(req);
  const locator = body?.locator;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) || null : null;
  const percent =
    typeof body?.percent === "number" && Number.isFinite(body.percent) ? Math.min(100, Math.max(0, body.percent)) : 0;
  if (typeof locator !== "string" || locator.length === 0 || locator.length > 600) {
    return new Response("Position invalide.", { status: 400 });
  }

  const where = { userId: auth.user.id, workId: auth.workId };
  const existing = await db.bookmark.findUnique({ where: { userId_workId_locator: { ...where, locator } }, select });
  if (existing) return Response.json(existing);

  if ((await db.bookmark.count({ where })) >= MAX_PER_BOOK) {
    return new Response("Nombre maximum de signets atteint pour ce livre.", { status: 409 });
  }
  const created = await db.bookmark.create({ data: { ...where, locator, label, percent }, select });
  return Response.json(created, { status: 201 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isJson(req)) return new Response("Format invalide.", { status: 415 });
  const auth = await authorize(ctx);
  if ("error" in auth) return auth.error;
  const id = (await readBody(req))?.id;
  if (typeof id !== "string") return new Response("Identifiant invalide.", { status: 400 });
  // Filtré par compte et par livre : on ne peut supprimer que ses propres signets.
  await db.bookmark.deleteMany({ where: { id, userId: auth.user.id, workId: auth.workId } });
  return new Response(null, { status: 204 });
}
