-- The Piston Skull goes on sale with the release that lists it (owner,
-- 2026-10-08): ACTIVE, with 25 of each colourway.
--
-- Data only. Guarded so it can only open the sale once: stock is set only on
-- variants still at 0 while the product is still a DRAFT, and only a DRAFT is
-- published, so anything staff have set in Admin > Products since is left alone.

UPDATE "variants" AS v
SET "stock" = 25, "updated_at" = CURRENT_TIMESTAMP
FROM "products" AS p
WHERE v."product_id" = p."id"
  AND p."slug" = 'piston-skull-mount'
  AND p."status" = 'DRAFT'
  AND v."stock" = 0;

UPDATE "products"
SET "status" = 'ACTIVE', "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'piston-skull-mount'
  AND "status" = 'DRAFT';
