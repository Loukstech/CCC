-- CreateTable
CREATE TABLE "Subtitle" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subtitle_workId_idx" ON "Subtitle"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_workId_lang_key" ON "Subtitle"("workId", "lang");

-- AddForeignKey
ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
