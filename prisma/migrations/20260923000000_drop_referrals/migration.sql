-- Removes the referral programme.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Guarded with
-- IF EXISTS throughout so it is safe to run against a database that never had
-- these objects, or that has already had them dropped.
--
-- Order matters: the dependent column on orders goes before the table it
-- points at, or the DROP TABLE fails on the foreign key.

-- orders.referral_id and its index
DROP INDEX IF EXISTS "orders_referral_id_idx";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_referral_id_fkey";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_id";

-- the referrals table itself
DROP TABLE IF EXISTS "referrals";

-- the enum only that table used
DROP TYPE IF EXISTS "ReferralStatus";

-- the two user columns the programme owned
DROP INDEX IF EXISTS "users_referral_code_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code";
ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_balance";

-- the scopes, and any role grant pointing at them
DELETE FROM "role_permissions"
WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "module" = 'referral');
DELETE FROM "permissions" WHERE "module" = 'referral';
