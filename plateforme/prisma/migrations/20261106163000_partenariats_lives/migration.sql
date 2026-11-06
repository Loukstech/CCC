-- Lot 8 : codes de partenariat + evenements en direct.
-- Migration purement additive : aucune table ni colonne existante n'est modifiee.

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('WRITER', 'DIOCESE');

-- CreateEnum
CREATE TYPE "LiveProvider" AS ENUM ('EMBED', 'MUX');

-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LiveVisibility" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'SUBSCRIBERS');

-- CreateTable
CREATE TABLE "PartnerCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL,
    "contractRef" TEXT,
    "dioceseId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveBroadcaster" (
    "userId" TEXT NOT NULL,
    "grantedById" TEXT,
    "note" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveBroadcaster_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "provider" "LiveProvider" NOT NULL DEFAULT 'EMBED',
    "embedUrl" TEXT,
    "playbackId" TEXT,
    "replayUrl" TEXT,
    "status" "LiveStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "LiveVisibility" NOT NULL DEFAULT 'PUBLIC',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "broadcasterId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCode_codeHash_key" ON "PartnerCode"("codeHash");

-- CreateIndex
CREATE INDEX "PartnerCode_kind_usedAt_idx" ON "PartnerCode"("kind", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEvent_slug_key" ON "LiveEvent"("slug");

-- CreateIndex
CREATE INDEX "LiveEvent_status_startsAt_idx" ON "LiveEvent"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCode" ADD CONSTRAINT "PartnerCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBroadcaster" ADD CONSTRAINT "LiveBroadcaster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBroadcaster" ADD CONSTRAINT "LiveBroadcaster_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_broadcasterId_fkey" FOREIGN KEY ("broadcasterId") REFERENCES "LiveBroadcaster"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
