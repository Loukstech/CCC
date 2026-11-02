import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Compte un clic sur une publicité puis redirige vers le site de l'annonceur. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ad = await db.ad
    .update({ where: { id }, data: { clicks: { increment: 1 } }, select: { linkUrl: true } })
    .catch(() => null);
  const target = ad && /^https?:\/\//i.test(ad.linkUrl) ? ad.linkUrl : new URL("/", request.url).toString();
  return NextResponse.redirect(target, 302);
}
