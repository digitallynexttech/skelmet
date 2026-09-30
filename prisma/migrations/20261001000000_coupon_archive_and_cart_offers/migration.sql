-- Two things staff can now do with a discount code.
--
-- `archived_at`: put a code away. It leaves the console's list for its
-- Archive tab, and it is no longer accepted - a code nobody can see in the
-- console should not be quietly working at checkout. Restoring it clears this.
-- `show_in_cart`: offer the code in the cart drawer, for the buyer to apply
-- with a tap instead of having to know it.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "show_in_cart" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "coupons_show_in_cart_archived_at_idx"
  ON "coupons" ("show_in_cart", "archived_at");
