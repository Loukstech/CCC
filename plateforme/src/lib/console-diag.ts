import "server-only";
import { db } from "@/lib/db";

/**
 * Diagnostic instantané de la console. Isolé dans un module serveur (et non dans un composant
 * React) : la mesure du temps est volontairement impure, elle n'a pas sa place dans un rendu.
 */
export async function consoleDiagnostics(): Promise<{ dbLatencyMs: number; tableCount: number }> {
  const started = Date.now();
  const [tables] = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
  `;
  return { dbLatencyMs: Date.now() - started, tableCount: Number(tables?.n ?? 0) };
}
