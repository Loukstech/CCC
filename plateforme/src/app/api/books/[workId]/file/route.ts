import { getCurrentUser } from "@/lib/dal";
import { authorizeRead } from "@/lib/reading";
import { readBookFile } from "@/lib/storage";

/** Sert le fichier d'un livre uniquement à son propriétaire, dans un pays autorisé. */
export async function GET(_req: Request, ctx: RouteContext<"/api/books/[workId]/file">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });

  const { workId } = await ctx.params;
  const access = await authorizeRead(user, { id: workId });
  if (!access.ok) {
    return new Response(access.reason === "not-found" || access.reason === "no-file" ? "Introuvable." : "Accès refusé.", {
      status: access.reason === "not-found" || access.reason === "no-file" ? 404 : 403,
    });
  }

  const file = await readBookFile(access.work.fileKey);
  if (!file) return new Response("Introuvable.", { status: 404 });

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Length": String(file.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
