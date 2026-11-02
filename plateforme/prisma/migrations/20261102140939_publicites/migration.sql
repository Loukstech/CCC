-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('HOME', 'CATALOG', 'WORK', 'STICKY');

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "advertiser" TEXT NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_placement_active_idx" ON "Ad"("placement", "active");
