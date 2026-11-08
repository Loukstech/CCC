import Link from "next/link";
import { ConsoleCard, ConsoleTable, Pill, type TableRow } from "@/components/admin/ConsoleUI";
import { DASHBOARD_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { ct } from "@/lib/console-i18n";
import { getLang } from "@/lib/lang";
import type { Lang } from "@/lib/i18n";

/** Journal d'audit : historique filtrable, du plus récent au plus ancien. */
export const instant = false;

const PAGE_SIZE = 100;

export async function generateMetadata() {
  return { title: `${ct(await getLang(), "audit.title")} — CCC` };
}

function fmt(d: Date, lang: Lang): string {
  return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const [lang, query] = await Promise.all([getLang(), searchParams]);
  await requireStaff(DASHBOARD_ROLES);
  const action = query.action?.trim() || "";
  const page = Math.max(0, Math.min(1000, Number.parseInt(query.page ?? "0", 10) || 0));

  const [actions, rows, total, filtered] = await Promise.all([
    db.auditLog.groupBy({
      by: ["action"], _count: { _all: true },
      orderBy: { _count: { action: "desc" } }, take: 60,
    }),
    db.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      select: { id: true, actorId: true, action: true, target: true, details: true, createdAt: true },
    }),
    db.auditLog.count(),
    action ? db.auditLog.count({ where: { action } }) : db.auditLog.count(),
  ]);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const names = new Map(actors.map((a) => [a.id, a.name ?? a.email ?? a.id.slice(-8)]));

  const href = (nextAction: string, nextPage: number) => {
    const p = new URLSearchParams();
    if (nextAction) p.set("action", nextAction);
    if (nextPage > 0) p.set("page", String(nextPage));
    const s = p.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  const tableRows: TableRow[] = rows.map((r) => {
    let details = "";
    if (r.details !== null && r.details !== undefined) {
      try {
        details = JSON.stringify(r.details);
        if (details.length > 180) details = `${details.slice(0, 180)}…`;
      } catch { details = "—"; }
    }
    return {
      key: r.id,
      cells: [
        <span key="d" className="whitespace-nowrap text-muted">{fmt(r.createdAt, lang)}</span>,
        <span key="a" className="block max-w-[11rem] truncate text-muted">
          {r.actorId ? (names.get(r.actorId) ?? r.actorId.slice(-8)) : "—"}
        </span>,
        <span key="ac" className="font-mono text-[11px] text-brand">{r.action}</span>,
        <span key="t" className="block max-w-[10rem] truncate font-mono text-[11px] text-muted">{r.target ?? "—"}</span>,
        <span key="de" className="block max-w-[26rem] truncate font-mono text-[11px] text-muted" title={details}>{details || "—"}</span>,
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{ct(lang, "eyebrow")}</p>
          <h1 className="font-display text-2xl font-semibold text-brand xl:text-3xl">{ct(lang, "audit.title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted">{ct(lang, "audit.lead")}</p>
        </div>
        <Pill tone="brand">{`${total.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${ct(lang, "col.rows").toLowerCase()}`}</Pill>
      </header>

      {/* Filtre par action */}
      <nav aria-label={ct(lang, "audit.filter")} className="flex flex-wrap items-center gap-1.5">
        <Link
          href={href("", 0)}
          aria-current={!action ? "true" : undefined}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${!action ? "border-brand bg-brand text-white" : "border-line text-muted hover:border-brand hover:text-brand"}`}
        >
          {ct(lang, "audit.all")}
        </Link>
        {actions.map((a) => (
          <Link
            key={a.action}
            href={href(a.action, 0)}
            aria-current={action === a.action ? "true" : undefined}
            className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${action === a.action ? "border-brand bg-brand text-white" : "border-line text-muted hover:border-brand hover:text-brand"}`}
          >
            {a.action} <span className="opacity-70">({a._count._all})</span>
          </Link>
        ))}
      </nav>

      <ConsoleCard
        title={ct(lang, "audit.title")}
        lead={`${ct(lang, "common.showing", { n: rows.length })} · ${filtered.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${ct(lang, "common.of")} ${total.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")}`}
        aside={
          <span className="flex items-center gap-2 text-[11px]">
            {page > 0 && <Link href={href(action, page - 1)} className="text-brand hover:underline">← {page}</Link>}
            <span className="text-muted">{page + 1}</span>
            {(page + 1) * PAGE_SIZE < filtered && (
              <Link href={href(action, page + 1)} className="text-brand hover:underline">{page + 2} →</Link>
            )}
          </span>
        }
      >
        <ConsoleTable
          head={[
            ct(lang, "col.time"), ct(lang, "col.actor"), ct(lang, "col.action"),
            ct(lang, "col.target"), ct(lang, "col.value"),
          ]}
          rows={tableRows}
          empty={ct(lang, "audit.empty")}
        />
      </ConsoleCard>
    </div>
  );
}
