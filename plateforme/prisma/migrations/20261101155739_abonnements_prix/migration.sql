-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_workId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "plan" "Plan",
ALTER COLUMN "workId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_plan_country_key" ON "PlanPrice"("plan", "country");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
