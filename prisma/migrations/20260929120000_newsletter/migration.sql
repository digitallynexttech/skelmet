-- The newsletter: the drop list's subscribers, the emails sent to them from
-- the console, and one delivery row per email per subscriber.
--
-- The home page's "Notify me" used to file each address as an inquiry under
-- the topic "Drop list", so the addresses are carried over here, once each,
-- dated from their first sign-up. The inquiry rows are left where they are.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

DO $$ BEGIN
  CREATE TYPE "SubscriberStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('SENDING', 'PAUSED', 'SENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "source" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_token_key" ON "newsletter_subscribers"("token");
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_status_subscribed_at_idx" ON "newsletter_subscribers"("status", "subscribed_at");

CREATE TABLE IF NOT EXISTS "newsletter_campaigns" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'SENDING',
    "recipients" INTEGER NOT NULL,
    "note" TEXT,
    "sent_by_id" UUID,
    "sent_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "newsletter_campaigns_created_at_idx" ON "newsletter_campaigns"("created_at");

CREATE TABLE IF NOT EXISTS "newsletter_deliveries" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_deliveries_campaign_id_subscriber_id_key" ON "newsletter_deliveries"("campaign_id", "subscriber_id");
CREATE INDEX IF NOT EXISTS "newsletter_deliveries_campaign_id_status_idx" ON "newsletter_deliveries"("campaign_id", "status");
CREATE INDEX IF NOT EXISTS "newsletter_deliveries_subscriber_id_idx" ON "newsletter_deliveries"("subscriber_id");

DO $$ BEGIN
  ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "newsletter_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The drop list so far. Two random UUIDs make the token: 64 hex characters
-- like the app's own, with 244 random bits from the server's CSPRNG.
INSERT INTO "newsletter_subscribers" ("id", "email", "status", "source", "token", "subscribed_at", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    lower(trim("email")),
    'SUBSCRIBED',
    'drop-list',
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    min("created_at"),
    min("created_at"),
    CURRENT_TIMESTAMP
FROM "inquiries"
WHERE "topic" = 'Drop list' AND trim("email") <> ''
GROUP BY lower(trim("email"))
ON CONFLICT ("email") DO NOTHING;
