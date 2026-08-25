-- Orders need to know how they are being paid for. Without it a cash-on-delivery
-- order is indistinguishable from an unpaid card order, so fulfilment either
-- refuses to pack COD at all or risks shipping an unpaid card order.
DO $$
BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'COD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- Backfill: an existing order with no payment row was never handed to the
-- gateway, which for this schema only ever happened for cash on delivery.
UPDATE "orders" o
SET "payment_method" = 'COD'
WHERE NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."order_id" = o."id");

CREATE INDEX IF NOT EXISTS "orders_payment_method_status_idx"
  ON "orders" ("payment_method", "status");
