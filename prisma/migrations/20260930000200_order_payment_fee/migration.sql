-- What paying on delivery adds to an order, and what the courier collects.
--
-- `payment_fee` is the cash-on-delivery charge, part of `total`. Until now it
-- was only ever the difference between the total and its other parts.
-- `due_on_delivery` is what is collected at the door: the whole total for
-- cash on delivery, the balance for an order with an advance paid online.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "due_on_delivery" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Orders placed as cash on delivery before these columns existed: the fee is
-- whatever the total holds beyond the goods, the discount and the shipping,
-- and the courier was to collect all of it. Only rows still at the default
-- are touched, so running this again changes nothing.
UPDATE "orders"
SET "payment_fee" = "total" - "subtotal" + "discount" - "shipping" - "tax"
WHERE "payment_method" = 'COD'
  AND "payment_fee" = 0
  AND "total" - "subtotal" + "discount" - "shipping" - "tax" > 0;

UPDATE "orders"
SET "due_on_delivery" = "total"
WHERE "payment_method" = 'COD'
  AND "due_on_delivery" = 0;
