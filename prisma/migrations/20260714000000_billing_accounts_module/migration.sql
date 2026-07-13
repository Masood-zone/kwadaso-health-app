-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "notes" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT,
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "replacementInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "sourceKey" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "notes" TEXT,
ADD COLUMN "approvalReference" TEXT,
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversedById" TEXT,
ADD COLUMN "reversalReason" TEXT,
ADD COLUMN "reversalReference" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_cancelledById_idx" ON "Invoice"("cancelledById");
CREATE INDEX "Invoice_voidedById_idx" ON "Invoice"("voidedById");
CREATE INDEX "Invoice_replacementInvoiceId_idx" ON "Invoice"("replacementInvoiceId");
CREATE UNIQUE INDEX "InvoiceItem_sourceKey_key" ON "InvoiceItem"("sourceKey");
CREATE INDEX "Payment_approvedById_idx" ON "Payment"("approvedById");
CREATE INDEX "Payment_reversedById_idx" ON "Payment"("reversedById");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_replacementInvoiceId_fkey" FOREIGN KEY ("replacementInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
