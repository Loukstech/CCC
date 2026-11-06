-- AlterEnum
ALTER TYPE "AdPlacement" ADD VALUE 'INTERSTITIAL';

-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdDailyStat_day_idx" ON "AdDailyStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyStat_adId_day_key" ON "AdDailyStat"("adId", "day");

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
