"use client";

import { useEffect } from "react";
import { reportAudience, type AudienceClientKind } from "@/lib/audience-client";

/**
 * Composant invisible : compte une ouverture réelle de fiche, côté navigateur, après
 * l'hydratation. Les rendus serveur, pré-rendus et robots sans JavaScript ne comptent pas.
 */
export function AudienceTracker({ workId, kind }: { workId: string; kind: AudienceClientKind }) {
  useEffect(() => {
    reportAudience(workId, kind);
  }, [workId, kind]);
  return null;
}
