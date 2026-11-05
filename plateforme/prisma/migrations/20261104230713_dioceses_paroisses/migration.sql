-- CreateEnum
CREATE TYPE "DioceseAdminRole" AS ENUM ('ADMIN', 'VIEWER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "parishConsentAt" TIMESTAMP(3),
ADD COLUMN     "parishId" TEXT;

-- CreateTable
CREATE TABLE "Diocese" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diocese_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parish" (
    "id" TEXT NOT NULL,
    "dioceseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DioceseAdmin" (
    "userId" TEXT NOT NULL,
    "dioceseId" TEXT NOT NULL,
    "role" "DioceseAdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DioceseAdmin_pkey" PRIMARY KEY ("userId","dioceseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Diocese_slug_key" ON "Diocese"("slug");

-- CreateIndex
CREATE INDEX "Diocese_country_active_idx" ON "Diocese"("country", "active");

-- CreateIndex
CREATE INDEX "Parish_dioceseId_active_idx" ON "Parish"("dioceseId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Parish_dioceseId_name_key" ON "Parish"("dioceseId", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parishId_fkey" FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parish" ADD CONSTRAINT "Parish_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parish" ADD CONSTRAINT "Parish_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Parish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DioceseAdmin" ADD CONSTRAINT "DioceseAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DioceseAdmin" ADD CONSTRAINT "DioceseAdmin_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE CASCADE ON UPDATE CASCADE;
