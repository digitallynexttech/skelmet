-- A third way to pay: an advance online, the balance to the courier.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). One statement,
-- alone in its file, as the CONFIRMED status before it. Safe to re-run.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PARTIAL';
