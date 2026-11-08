import { DASHBOARD_ROLES, getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getNumber } from "@/lib/settings";

/**
 * Exports CSV de la console. Route serveur (pas de client) :
 * - accès limité au personnel, y compris l'Analyste en lecture seule ;
 * - plafond de lignes issu des paramètres applicatifs (garde-fou contre un export massif) ;
 * - séparateur « ; » + BOM UTF-8, directement ouvrable dans Excel francophone ;
 * - chaque téléchargement est tracé dans le journal d'audit.
 */
// `cacheComponents` est activé globalement : les segments ne peuvent pas redéclarer `runtime`
// ni `dynamic`. La route est naturellement dynamique (session + base), et `no-store` est posé
// sur la réponse elle-même.
type Cell = string | number | boolean | Date | null | undefined | object;
type Dataset = { head: string[]; rows: Cell[][] };

const DATASETS = ["users", "orders", "works", "subscriptions", "audit"] as const;
type DatasetId = (typeof DATASETS)[number];
const isDataset = (v: string): v is DatasetId => (DATASETS as readonly string[]).includes(v);

function escapeCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date
    ? v.toISOString()
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv({ head, rows }: Dataset): string {
  const lines = [head, ...rows].map((row) => row.map(escapeCell).join(";"));
  // BOM : Excel en français reconnaît l'UTF-8 sans réglage manuel.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

async function load(dataset: DatasetId, limit: number): Promise<Dataset> {
  switch (dataset) {
    case "users": {
      const rows = await db.user.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        select: {
          id: true, name: true, email: true, phone: true, country: true, locale: true,
          staffRole: true, disabledAt: true, parishId: true, parishConsentAt: true, createdAt: true,
        },
      });
      return {
        head: ["id", "name", "email", "phone", "country", "locale", "staffRole", "disabledAt", "parishId", "parishConsentAt", "createdAt"],
        rows: rows.map((r) => [r.id, r.name, r.email, r.phone, r.country, r.locale, r.staffRole, r.disabledAt, r.parishId, r.parishConsentAt, r.createdAt]),
      };
    }
    case "orders": {
      const rows = await db.order.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        select: {
          id: true, userId: true, workId: true, plan: true, status: true, currency: true,
          amount: true, feePpm: true, feeAmount: true, netAmount: true, provider: true,
          providerRef: true, createdAt: true, paidAt: true, refundedAt: true,
        },
      });
      return {
        head: ["id", "userId", "workId", "plan", "status", "currency", "amount", "feePpm", "feeAmount", "netAmount", "provider", "providerRef", "createdAt", "paidAt", "refundedAt"],
        rows: rows.map((r) => [r.id, r.userId, r.workId, r.plan, r.status, r.currency, r.amount, r.feePpm, r.feeAmount, r.netAmount, r.provider, r.providerRef, r.createdAt, r.paidAt, r.refundedAt]),
      };
    }
    case "works": {
      const rows = await db.work.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        select: {
          id: true, slug: true, title: true, author: true, authorId: true, type: true, status: true,
          access: true, language: true, downloadable: true, fileKey: true, durationMin: true, pages: true,
          ratingAvg: true, ratingCount: true, commentCount: true, publishedAt: true, createdAt: true,
        },
      });
      return {
        head: ["id", "slug", "title", "author", "authorId", "type", "status", "access", "language", "downloadable", "fileKey", "durationMin", "pages", "ratingAvg", "ratingCount", "commentCount", "publishedAt", "createdAt"],
        rows: rows.map((r) => [r.id, r.slug, r.title, r.author, r.authorId, r.type, r.status, r.access, r.language, r.downloadable, r.fileKey, r.durationMin, r.pages, r.ratingAvg, r.ratingCount, r.commentCount, r.publishedAt, r.createdAt]),
      };
    }
    case "subscriptions": {
      const rows = await db.subscription.findMany({
        orderBy: { startsAt: "desc" }, take: limit,
        select: { id: true, userId: true, plan: true, status: true, startsAt: true, endsAt: true, renewsAt: true, provider: true },
      });
      return {
        head: ["id", "userId", "plan", "status", "startsAt", "endsAt", "renewsAt", "provider"],
        rows: rows.map((r) => [r.id, r.userId, r.plan, r.status, r.startsAt, r.endsAt, r.renewsAt, r.provider]),
      };
    }
    case "audit": {
      const rows = await db.auditLog.findMany({
        orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, actorId: true, action: true, target: true, details: true, createdAt: true },
      });
      return {
        head: ["id", "actorId", "action", "target", "details", "createdAt"],
        rows: rows.map((r) => [r.id, r.actorId, r.action, r.target, r.details ?? null, r.createdAt]),
      };
    }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const { dataset } = await params;
  const user = await getCurrentUser();
  if (!user || !user.staffRole || !DASHBOARD_ROLES.includes(user.staffRole)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!isDataset(dataset)) {
    return new Response("Not found", { status: 404 });
  }

  const limit = await getNumber("export_rows_limit");
  const data = await load(dataset, limit);
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "export.csv",
      target: dataset,
      details: { rows: data.rows.length, limit },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(data), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ccc-${dataset}-${stamp}.csv"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
