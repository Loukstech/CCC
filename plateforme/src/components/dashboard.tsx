import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

/**
 * Briques visuelles des tableaux de bord. Composants serveur, sans JavaScript côté client et sans
 * dépendance graphique : un SVG inline et des barres CSS. Les couleurs viennent des variables du
 * thème (`globals.css`), donc le rendu suit automatiquement le mode clair / sombre.
 */

const panel = "rounded-2xl border border-line bg-surface p-5 shadow-sm";

/** Nombre compact pour les KPI : 1 250 → « 1,3 k », 12 → « 12 ». */
export function compact(n: number, lang: Lang): string {
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  if (n < 1000) return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1000) + " k";
}

/** Libellé court d'un mois « AAAA-MM » : « nov. » / « Nov ». */
export function monthLabel(key: string, lang: Lang): string {
  const d = new Date(`${key}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: "brand" | "gold" | "plain";
}) {
  const accentClass =
    accent === "gold" ? "text-gold" : accent === "plain" ? "text-ink" : "text-brand";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        {icon && <span className={`shrink-0 opacity-60 ${accentClass}`}>{icon}</span>}
      </div>
      <p className={`font-display mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${accentClass}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function DashboardCard({
  title,
  lead,
  aside,
  children,
  className = "",
}: {
  title: string;
  lead?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${panel} ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand sm:text-xl">{title}</h2>
          {lead && <p className="mt-0.5 text-xs text-muted">{lead}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export type ChartSeries = {
  label: string;
  values: number[];
  /** Variable CSS ou couleur littérale du trait et de l'aire. */
  color: string;
  /** Format des valeurs dans l'infobulle native. */
  format: (n: number) => string;
};

/**
 * Courbe d'évolution sur 6 mois. `viewBox` fixe + `preserveAspectRatio="none"` sur le tracé
 * uniquement : le texte reste lisible quelle que soit la largeur du conteneur.
 */
export function TrendChart({
  months,
  series,
  lang,
  ariaLabel,
}: {
  months: string[];
  series: ChartSeries[];
  lang: Lang;
  ariaLabel: string;
}) {
  const W = 600;
  const H = 180;
  const PAD_X = 10;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 30;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) =>
    PAD_X + (months.length <= 1 ? (W - 2 * PAD_X) / 2 : (i * (W - 2 * PAD_X)) / (months.length - 1));
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full sm:h-52"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + plotH * (1 - f)}
            y2={PAD_TOP + plotH * (1 - f)}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray={f === 0 ? undefined : "3 4"}
          />
        ))}
        {series.map((s) => {
          const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const area = `${line} L${x(s.values.length - 1).toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_TOP + plotH).toFixed(1)} Z`;
          return (
            <g key={s.label}>
              <path d={area} fill={s.color} fillOpacity="0.1" />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2">
                  <title>{`${monthLabel(months[i], lang)} · ${s.label} : ${s.format(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {months.map((m, i) => (
          <text
            key={m}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted)"
          >
            {monthLabel(m, lang)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto">{`0 → ${series[0]?.format(max) ?? ""}`}</span>
      </figcaption>
    </figure>
  );
}

/** Barres de répartition : chaque ligne porte un libellé, une barre proportionnelle et la valeur. */
export function BreakdownBars({
  items,
}: {
  items: { label: string; count: number; color?: string }[];
}) {
  const total = items.reduce((n, i) => n + i.count, 0);
  return (
    <ul className="flex flex-col gap-3">
      {items.length === 0 && <li className="text-sm text-muted">—</li>}
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <li key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">{item.label}</span>
              <span className="tabular-nums text-muted">
                {item.count} <span className="text-xs">· {pct} %</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%`, background: item.color ?? "var(--brand)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Pastille numérique pour les tuiles d'accès rapide (éléments « à traiter »). */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
      {count}
    </span>
  );
}
