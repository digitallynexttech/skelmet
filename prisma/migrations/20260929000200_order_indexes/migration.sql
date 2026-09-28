-- Indexes for the columns the order lists and the dashboard filter on:
-- payment_method (the stale unpaid-order sweep and the abandoned-carts list)
-- and placed_at (the dashboard's today and this-week tiles).
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

CREATE INDEX IF NOT EXISTS "orders_payment_method_idx" ON "orders"("payment_method");
CREATE INDEX IF NOT EXISTS "orders_placed_at_idx" ON "orders"("placed_at");
