-- Shiprocket: the ids an order gets there, and what a booked shipment carries.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded with IF NOT EXISTS so it is safe to re-run.

-- orders: Shiprocket's order and shipment ids
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shiprocket_order_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shiprocket_shipment_id" TEXT;
-- Tracking updates find their order by it, and one order is one Shiprocket order.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_shiprocket_order_id_key" ON "orders"("shiprocket_order_id");

-- shipments: where it came from, its paperwork, and the courier's latest word
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "label_url" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "manifest_url" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_scheduled_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "etd" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "status_at" TIMESTAMP(3);
