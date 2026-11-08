-- Statistiques d'audience réelles : compteurs cumulés sur Work + historique journalier.
-- Migration purement additive : aucune table ni colonne existante n'est supprimée ou modifiée,
-- et les colonnes nouvelles ont une valeur par défaut (les œuvres existantes démarrent à 0).

ALTER TABLE "Work"
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "playCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkAudienceStat" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAudienceStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkAudienceStat_workId_day_key" ON "WorkAudienceStat"("workId", "day");
CREATE INDEX "WorkAudienceStat_day_idx" ON "WorkAudienceStat"("day");

ALTER TABLE "WorkAudienceStat"
  ADD CONSTRAINT "WorkAudienceStat_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
