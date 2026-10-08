-- The second product: the Piston Skull Helmet Mount, in the same three
-- colourways as the first (features/catalog/catalog.ts, PISTON_SKULL_MOUNT).
--
-- It starts as a DRAFT with no stock: its page is up and reads sold out, and
-- checkout refuses it, until staff add stock and publish it from
-- Admin > Products. The price is the owner's, ₹3,499 (MRP ₹4,999 is the
-- registry's, shown on the page).
--
-- Hand-written and applied with `prisma migrate deploy` (§6). Additive only,
-- and guarded so it is safe to re-run: rows that already exist - and any
-- price or stock staff have set on them since - are left as they are.

INSERT INTO "products" ("id", "slug", "name", "strapline", "base_price", "status", "updated_at")
VALUES (
  gen_random_uuid(),
  'piston-skull-mount',
  'Piston Skull Helmet Mount',
  'Mohawk up, piston in its teeth. A wall for the lid that earned it.',
  3499,
  'DRAFT',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "variants" ("id", "product_id", "colourway", "sku", "price", "stock", "updated_at")
SELECT gen_random_uuid(), p."id", v.colourway, v.sku, 3499, 0, CURRENT_TIMESTAMP
FROM "products" p
CROSS JOIN (
  VALUES ('blaze', 'SKM-PST-BLZ'), ('olive', 'SKM-PST-OLV'), ('ghost', 'SKM-PST-GHT')
) AS v (colourway, sku)
WHERE p."slug" = 'piston-skull-mount'
ON CONFLICT ("sku") DO NOTHING;
