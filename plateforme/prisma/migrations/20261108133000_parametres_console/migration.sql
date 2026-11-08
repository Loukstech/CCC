-- Paramètres applicatifs modifiables depuis la console d'administration.
-- Migration purement additive : aucune table ni colonne existante n'est modifiée.
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
