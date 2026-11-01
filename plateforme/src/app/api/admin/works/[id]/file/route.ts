import { FILE_ROLES, getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { validateEpub } from "@/lib/epub";
import { saveBookFile } from "@/lib/storage";

const back = (id: string, query: string) =>
  new Response(null, { status: 303, headers: { Location: `/admin/oeuvres/${id}?${query}` } });

/** Reçoit le fichier EPUB d'un livre (formulaire envoyé par le personnel autorisé). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/works/[id]/file">) {
  // Le cookie de session est « lax » : un autre site ne peut pas envoyer ce formulaire. On vérifie aussi l'origine.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response("Origine refusée.", { status: 403 });

  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });
  if (!user.staffRole || !FILE_ROLES.includes(user.staffRole)) return new Response("Accès refusé.", { status: 403 });

  const { id } = await ctx.params;
  const work = await db.work.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!work) return new Response("Introuvable.", { status: 404 });
  if (work.type !== "BOOK") return back(id, "erreur=type");

  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) return back(id, "erreur=vide");

  const data = Buffer.from(await file.arrayBuffer());
  const problem = await validateEpub(data);
  if (problem) return back(id, `erreur=${problem}`);

  const fileKey = `${work.id}.epub`;
  try {
    await saveBookFile(fileKey, data);
  } catch {
    // Hébergement sans disque inscriptible (ex. fonctions Vercel) : le stockage de fichiers reste à brancher.
    return back(id, "erreur=stockage");
  }
  await db.work.update({ where: { id: work.id }, data: { fileKey } });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.file", target: work.id, details: { name: file.name.slice(0, 120), bytes: data.length } },
  });
  return back(id, "ok=fichier");
}
