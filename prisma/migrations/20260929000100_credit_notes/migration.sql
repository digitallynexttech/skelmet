-- Credit notes: a refunded order that already has a tax invoice gets a credit
-- note reversing it, numbered CN/<fy>/0001 upwards. The numbers come from
-- invoice_counters under their own key ("CN-26-27"), so no new table.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "credit_note_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "credited_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_credit_note_number_key" ON "orders"("credit_note_number");
