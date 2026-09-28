-- Session versions: every console session token carries the user's
-- session_version from sign-in, and a password reset or change, a revoke or a
-- role removal bumps it, ending every session opened before it (see
-- server/session-policy.ts).
--
-- Tokens minted before this migration carry no version, so every member of
-- staff is signed out once when it ships.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
