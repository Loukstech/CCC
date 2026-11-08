import { trackAudience, type AudienceKind } from "@/lib/audience";

/**
 * Point d'entrée des événements d'audience déclenchés par le navigateur (ouverture de fiche,
 * démarrage de lecture). Le téléchargement, lui, est compté côté serveur dans la route de fichier :
 * il n'est donc pas exposé ici et ne peut pas être simulé par un simple POST.
 *
 * `cacheComponents` interdit de redéclarer `runtime`/`dynamic` sur un segment : un POST est déjà
 * dynamique par nature, et le `no-store` est posé sur la réponse.
 */

const KINDS: AudienceKind[] = ["view", "play"];

/** Rejette les appels manifestement cross-site ; les visiteurs anonymes restent acceptés. */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return new Response(null, { status: 415 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const body = payload as { workId?: unknown; kind?: unknown } | null;
  if (
    typeof body?.workId !== "string" ||
    body.workId.length < 5 ||
    body.workId.length > 64 ||
    typeof body.kind !== "string" ||
    !KINDS.includes(body.kind as AudienceKind)
  ) {
    return new Response(null, { status: 400 });
  }

  await trackAudience(body.workId, body.kind as AudienceKind);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, private" },
  });
}
