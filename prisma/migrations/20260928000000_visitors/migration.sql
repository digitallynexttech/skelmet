-- Visitors: who browses the storefront, on what, from where and for how long;
-- the cart each one leaves behind; and which visitor placed an order.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

-- visitors: a device that accepted cookies (kept a year), or one anonymous visit
CREATE TABLE IF NOT EXISTS "visitors" (
    "id" UUID NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "anon_key" UUID,
    "consent_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "engaged_seconds" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "pincode" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "device_model" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "screen" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "referrer" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "landing_page" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "visitors_anon_key_key" ON "visitors"("anon_key");
CREATE INDEX IF NOT EXISTS "visitors_last_seen_at_idx" ON "visitors"("last_seen_at");
CREATE INDEX IF NOT EXISTS "visitors_user_id_idx" ON "visitors"("user_id");
CREATE INDEX IF NOT EXISTS "visitors_email_idx" ON "visitors"("email");
CREATE INDEX IF NOT EXISTS "visitors_phone_idx" ON "visitors"("phone");

-- visitor_sessions: one visit, until thirty minutes pass without a page
CREATE TABLE IF NOT EXISTS "visitor_sessions" (
    "id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "engaged_seconds" INTEGER NOT NULL DEFAULT 0,
    "landing_page" TEXT,
    "exit_page" TEXT,
    "referrer" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "ip" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "visitor_sessions_visitor_id_key_key" ON "visitor_sessions"("visitor_id", "key");
CREATE INDEX IF NOT EXISTS "visitor_sessions_visitor_id_started_at_idx" ON "visitor_sessions"("visitor_id", "started_at");
CREATE INDEX IF NOT EXISTS "visitor_sessions_started_at_idx" ON "visitor_sessions"("started_at");

-- visitor_events: pages seen and for how long, cart changes, checkout, orders
CREATE TABLE IF NOT EXISTS "visitor_events" (
    "id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visitor_events_visitor_id_created_at_idx" ON "visitor_events"("visitor_id", "created_at");
CREATE INDEX IF NOT EXISTS "visitor_events_session_id_created_at_idx" ON "visitor_events"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "visitor_events_type_created_at_idx" ON "visitor_events"("type", "created_at");

-- carts: the browser's cart, copied per visitor, and when it reached checkout
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "visitor_id" UUID;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "checkout_at" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "carts_visitor_id_key" ON "carts"("visitor_id");
CREATE INDEX IF NOT EXISTS "carts_updated_at_idx" ON "carts"("updated_at");

-- orders: the visitor who placed it, when they had accepted cookies
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "visitor_id" UUID;
CREATE INDEX IF NOT EXISTS "orders_visitor_id_idx" ON "orders"("visitor_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "visitor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "carts" ADD CONSTRAINT "carts_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
