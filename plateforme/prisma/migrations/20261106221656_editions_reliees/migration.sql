-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "translationGroupId" TEXT,
ADD COLUMN     "translationPrimary" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Work_translationGroupId_idx" ON "Work"("translationGroupId");
