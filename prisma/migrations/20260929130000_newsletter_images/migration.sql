-- The newsletter's rich-text editor: each campaign keeps the editor's document
-- it was built from, and pictures placed in a message are stored here and
-- served publicly, since an email can only show an image it can fetch.
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run.

ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "content" JSONB;

CREATE TABLE IF NOT EXISTS "newsletter_images" (
    "id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_images_pkey" PRIMARY KEY ("id")
);
