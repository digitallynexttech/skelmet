-- A cash-on-delivery order is accepted without being paid for, so it needs a
-- state of its own: PENDING means "waiting for an online payment" and is
-- cancelled after an hour, and PAID would be a lie.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). One statement,
-- alone in its file: Postgres will not add an enum value and use it inside the
-- same transaction. Safe to re-run.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED' AFTER 'PENDING';
