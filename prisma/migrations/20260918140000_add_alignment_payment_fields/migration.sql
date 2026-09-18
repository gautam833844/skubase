-- CreateEnum
CREATE TYPE "AlignmentPaymentMode" AS ENUM ('CASH', 'UPI');

-- AlterTable
ALTER TABLE "alignment_bills" ADD COLUMN "payment_mode" "AlignmentPaymentMode",
ADD COLUMN "paid_amount" DECIMAL(12,2);
