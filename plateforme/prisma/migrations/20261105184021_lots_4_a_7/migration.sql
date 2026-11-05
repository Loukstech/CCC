-- CreateEnum
CREATE TYPE "LedgerParty" AS ENUM ('WRITER', 'DIOCESE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('SALE', 'REFUND', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "WriterStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ManuscriptStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "feeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feePpm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "party" "LedgerParty" NOT NULL,
    "orderId" TEXT,
    "beneficiaryUserId" TEXT,
    "dioceseId" TEXT,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ratePpm" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "party" "LedgerParty" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "party" "LedgerParty" NOT NULL,
    "beneficiaryUserId" TEXT,
    "dioceseId" TEXT,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WriterProfile" (
    "userId" TEXT NOT NULL,
    "penName" TEXT,
    "bio" TEXT,
    "status" "WriterStatus" NOT NULL DEFAULT 'PENDING',
    "payoutNetwork" TEXT,
    "payoutPhone" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WriterProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Manuscript" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "synopsis" TEXT,
    "fileUrl" TEXT,
    "status" "ManuscriptStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manuscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_key_key" ON "CommissionEntry"("key");

-- CreateIndex
CREATE INDEX "CommissionEntry_party_beneficiaryUserId_currency_createdAt_idx" ON "CommissionEntry"("party", "beneficiaryUserId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_party_dioceseId_currency_createdAt_idx" ON "CommissionEntry"("party", "dioceseId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_orderId_idx" ON "CommissionEntry"("orderId");

-- CreateIndex
CREATE INDEX "CommissionEntry_createdAt_idx" ON "CommissionEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutBatch_reference_key" ON "PayoutBatch"("reference");

-- CreateIndex
CREATE INDEX "PayoutBatch_party_status_periodEnd_idx" ON "PayoutBatch"("party", "status", "periodEnd");

-- CreateIndex
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutItem_batchId_idx" ON "PayoutItem"("batchId");

-- CreateIndex
CREATE INDEX "PayoutItem_beneficiaryUserId_idx" ON "PayoutItem"("beneficiaryUserId");

-- CreateIndex
CREATE INDEX "PayoutItem_dioceseId_idx" ON "PayoutItem"("dioceseId");

-- CreateIndex
CREATE INDEX "Manuscript_authorId_createdAt_idx" ON "Manuscript"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Manuscript_status_createdAt_idx" ON "Manuscript"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_dioceseId_fkey" FOREIGN KEY ("dioceseId") REFERENCES "Diocese"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriterProfile" ADD CONSTRAINT "WriterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manuscript" ADD CONSTRAINT "Manuscript_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
