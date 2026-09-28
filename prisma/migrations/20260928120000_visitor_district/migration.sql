-- Visitor location down to the district: the district on each visitor and
-- each visit, the state on each visit, and the district India Post files each
-- pincode under, looked up once per pincode.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "district" TEXT;

ALTER TABLE "visitor_sessions" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "visitor_sessions" ADD COLUMN IF NOT EXISTS "district" TEXT;

CREATE TABLE IF NOT EXISTS "pincode_places" (
    "pincode" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT,
    "looked_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pincode_places_pkey" PRIMARY KEY ("pincode")
);
