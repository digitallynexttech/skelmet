-- The approximate point Cloudflare places a visitor's connection at
-- (cf-iplatitude, cf-iplongitude). Kept, like the IP address, only for a
-- visitor who accepted cookies, and wiped with it when they withdraw.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
