-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_workId_fkey";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
