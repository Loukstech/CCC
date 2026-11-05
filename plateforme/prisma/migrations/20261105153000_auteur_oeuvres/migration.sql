-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "authorId" TEXT;

-- CreateIndex
CREATE INDEX "Work_authorId_idx" ON "Work"("authorId");

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
