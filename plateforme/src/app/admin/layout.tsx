import type { ReactNode } from "react";
import { ConsoleShell, type ConsoleNavGroup, type ConsoleNavLink } from "@/components/admin/ConsoleShell";
import {
  AD_ROLES,
  DASHBOARD_ROLES,
  EDITORIAL_ROLES,
  FINANCE_ROLES,
  LIVE_ROLES,
  MODERATION_ROLES,
  PARTNER_ROLES,
  REFERENTIAL_ROLES,
  requireStaff,
} from "@/lib/dal";
import { cl, ct } from "@/lib/console-i18n";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/settings";
import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Coque commune à tous les modules d'administration.
 *
 * Le contrôle d'accès est fait ici une première fois (tout le personnel peut consulter), puis
 * chaque page et chaque action d'écriture garde sa propre liste de rôles : le volet ne montre
 * jamais un lien vers une page qui refuserait l'accès.
 */
export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff(DASHBOARD_ROLES);
  const [lang, settings] = await Promise.all([getLang(), getSettings()]);
  const role = user.staffRole as StaffRole;
  const isReadOnly = role === "ANALYST";

  const link = (
    href: string,
    labelKey: Parameters<typeof ct>[1],
    icon: string,
    roles: StaffRole[],
  ): ConsoleNavLink | null => (roles.includes(role) ? { href, label: ct(lang, labelKey), icon } : null);

  const compact = <T,>(items: (T | null)[]): T[] => items.filter((i): i is T => i !== null);

  const groups: ConsoleNavGroup[] = [
    {
      id: "overview",
      label: ct(lang, "group.overview"),
      items: [{ href: "/admin", label: ct(lang, "nav.dashboard"), icon: "dashboard" }],
    },
    {
      id: "catalog",
      label: ct(lang, "group.catalog"),
      items: compact([
        link("/admin/manuscrits", "nav.manuscripts", "manuscripts", EDITORIAL_ROLES),
        link("/admin/moderation", "nav.moderation", "moderation", MODERATION_ROLES),
      ]),
    },
    {
      id: "community",
      label: ct(lang, "group.community"),
      items: compact([
        link("/admin/dioceses", "nav.dioceses", "dioceses", REFERENTIAL_ROLES),
        link("/admin/partenariats", "nav.partners", "partners", PARTNER_ROLES),
        link("/admin/lives", "nav.lives", "lives", LIVE_ROLES),
      ]),
    },
    {
      id: "money",
      label: ct(lang, "group.money"),
      items: compact([
        link("/admin/finances", "nav.finances", "finances", FINANCE_ROLES),
        link("/admin/publicites", "nav.ads", "ads", AD_ROLES),
      ]),
    },
    {
      id: "system",
      label: ct(lang, "group.system"),
      items: compact([
        link("/admin/parametres", "nav.settings", "settings", DASHBOARD_ROLES),
        link("/admin/outils", "nav.tools", "tools", isReadOnly ? [] : DASHBOARD_ROLES),
        link("/admin/audit", "nav.audit", "audit", DASHBOARD_ROLES),
      ]),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <ConsoleShell
      groups={groups}
      eyebrow={ct(lang, "eyebrow")}
      fallbackTitle={ct(lang, "title")}
      roleLabel={cl(lang, role)}
      userName={user.name ?? user.email ?? "?"}
      dense={settings.console_dense !== "false"}
      isReadOnly={isReadOnly}
      readOnlyNote={ct(lang, "readOnly")}
      labels={{
        menu: ct(lang, "menu"),
        close: ct(lang, "close"),
        backToSite: ct(lang, "backToSite"),
        refresh: ct(lang, "refresh"),
        period: ct(lang, "period"),
        role: ct(lang, "role"),
      }}
    >
      {children}
    </ConsoleShell>
  );
}
