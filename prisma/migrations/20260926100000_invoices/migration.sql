-- Tax invoices: each order's invoice number and dates, and a counter per
-- financial year that hands the numbers out in order.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoiced_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoice_emailed_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_invoice_number_key" ON "orders"("invoice_number");

CREATE TABLE IF NOT EXISTS "invoice_counters" (
    "fy" TEXT NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("fy")
);
