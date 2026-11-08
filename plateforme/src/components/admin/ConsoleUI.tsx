import type { ReactNode } from "react";
import { ct } from "@/lib/console-i18n";
import type { Lang } from "@/lib/i18n";

/**
 * Briques de la console. Volontairement sobres et denses : beaucoup de chiffres, peu de chrome.
 * Composants serveur (aucun JavaScript client), les couleurs suivent les variables du thème.
 */

const CARD = "rounded-xl border border-line bg-surface shadow-sm";

export function ConsoleCard({
  title,
  lead,
  aside,
  children,
  className = "",
  bodyClass = "",
}: {
  title: string;
  lead?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-brand">{title}</h2>
          {lead && <p className="mt-0.5 text-[11px] leading-snug text-muted">{lead}</p>}
        </div>
        {aside}
      </div>
      <div className={`min-w-0 flex-1 p-3.5 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export type TableRow = { key: string; cells: ReactNode[] };

/** Tableau dense, en-tête collante et défilement interne. `cells` suit l'ordre de `head`. */
export function ConsoleTable({
  head,
  rows,
  empty,
  scroll = true,
  align,
}: {
  head: string[];
  rows: TableRow[];
  empty: string;
  scroll?: boolean;
  align?: ("left" | "right" | "center")[];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted">{empty}</p>;
  }
  const table = (
    <table className="console-table">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={`${h}-${i}`} className={align?.[i] === "right" ? "text-right" : align?.[i] === "center" ? "text-center" : "text-left"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => (
              <td key={i} className={align?.[i] === "right" ? "text-right" : align?.[i] === "center" ? "text-center" : "text-left"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="-mx-3.5 -my-1 overflow-x-auto">
      <div className={scroll ? "console-scroll px-3.5" : "px-3.5"}>{table}</div>
    </div>
  );
}

export function Delta({ value, lang }: { value: number | null; lang: Lang }) {
  if (value === null) {
    return <span className="text-[10px] text-muted">{ct(lang, "noPrev")}</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
        positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
      title={ct(lang, "vsPrev", { n: value })}
    >
      <span aria-hidden>{positive ? "▲" : "▼"}</span>
      {Math.abs(value)} %
      <span className="sr-only">{ct(lang, "vsPrev", { n: value })}</span>
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  lang,
  accent = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  lang: Lang;
  accent?: "brand" | "gold";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className={`font-display text-xl font-semibold leading-none tabular-nums ${accent === "gold" ? "text-gold" : "text-brand"}`}>
          {value}
        </p>
        {delta !== undefined && <Delta value={delta} lang={lang} />}
      </div>
      {hint && <p className="mt-1 truncate text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "gold" | "red" }) {
  const cls =
    tone === "brand"
      ? "bg-brand/10 text-brand"
      : tone === "gold"
        ? "bg-gold-soft text-brand"
        : tone === "red"
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-line/70 text-muted";
  return <span className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

/** Petit couple libellé / valeur, utilisé dans les panneaux de synthèse. */
export function Metric({ label, value, tone }: { label: string; value: string; tone?: "brand" | "gold" }) {
  return (
    <div className="rounded-lg border border-line px-2.5 py-2">
      <p className="truncate text-[10px] text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${tone === "gold" ? "text-gold" : "text-brand"}`}>{value}</p>
    </div>
  );
}
