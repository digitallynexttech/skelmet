-- Settings changed from the console without a deploy, and which Razorpay
-- account took each payment.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

-- settings: one row per section (payment, shiprocket, shipping); secrets
-- inside `value` are sealed by the app before they are written.
CREATE TABLE IF NOT EXISTS "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- payments: "test" or "live". Null for everything taken before this, which
-- was all taken with the keys in .env.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "mode" TEXT;
