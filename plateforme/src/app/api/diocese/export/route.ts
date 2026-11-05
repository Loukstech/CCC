import { NextRequest, NextResponse } from "next/server";
import { requireDioceseScope } from "@/lib/dal";
import { db } from "@/lib/db";

/** Export CSV des fidèles du diocèse. Réservé au périmètre du compte connecté. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const requested = String(formData.get("dioceseId") ?? "");

  // Un administrateur diocésain est ramené à son diocèse ; un super-administrateur doit en désigner un.
  const scope = await requireDioceseScope(requested || undefined);

  const users = await db.user.findMany({
    where: { parish: { dioceseId: scope.dioceseId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      country: true,
      createdAt: true,
      parish: { select: { name: true } },
    },
  });

  const header = ["id", "email", "nom", "pays", "paroisse", "inscription"];
  const rows = users.map((u) => [
    u.id,
    u.email ?? "",
    u.name ?? "",
    u.country ?? "",
    u.parish?.name ?? "",
    new Date(u.createdAt).toISOString().slice(0, 10),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fideles-${scope.dioceseId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
