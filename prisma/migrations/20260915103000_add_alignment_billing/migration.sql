-- CreateEnum
CREATE TYPE "AlignmentDocType" AS ENUM ('ESTIMATE', 'BILL');

-- CreateEnum
CREATE TYPE "AlignmentBillStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- CreateTable
CREATE TABLE "alignment_bills" (
    "id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "document_type" "AlignmentDocType" NOT NULL DEFAULT 'BILL',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "vehicle_number" TEXT NOT NULL,
    "kilometers" INTEGER,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "AlignmentBillStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alignment_bill_items" (
    "id" TEXT NOT NULL,
    "alignment_bill_id" TEXT NOT NULL,
    "particular" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "alignment_bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alignment_bills_bill_number_key" ON "alignment_bills"("bill_number");

-- CreateIndex
CREATE INDEX "alignment_bills_date_idx" ON "alignment_bills"("date");

-- CreateIndex
CREATE INDEX "alignment_bills_bill_number_idx" ON "alignment_bills"("bill_number");

-- CreateIndex
CREATE INDEX "alignment_bills_customer_id_idx" ON "alignment_bills"("customer_id");

-- CreateIndex
CREATE INDEX "alignment_bills_vehicle_number_idx" ON "alignment_bills"("vehicle_number");

-- CreateIndex
CREATE INDEX "alignment_bills_document_type_idx" ON "alignment_bills"("document_type");

-- CreateIndex
CREATE INDEX "alignment_bills_created_by_id_idx" ON "alignment_bills"("created_by_id");

-- CreateIndex
CREATE INDEX "alignment_bill_items_alignment_bill_id_idx" ON "alignment_bill_items"("alignment_bill_id");

-- AddForeignKey
ALTER TABLE "alignment_bills" ADD CONSTRAINT "alignment_bills_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_bills" ADD CONSTRAINT "alignment_bills_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_bill_items" ADD CONSTRAINT "alignment_bill_items_alignment_bill_id_fkey" FOREIGN KEY ("alignment_bill_id") REFERENCES "alignment_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
