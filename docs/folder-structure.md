# SKELMET - Folder Structure

Concrete realisation of `docs/dn-nextjs-standard.md` §2–§4 for this store.
No `src/`. `@/*` → `./*`. `app/` is routing only; logic lives in `features/`.

```
app/
  (marketing)/
    layout.tsx                          storefront shell: header, cart drawer, footer
    page.tsx                            /                      "use client"
    loading.tsx
    error.tsx
    shop/{layout,page,loading}.tsx      /shop
    product/[slug]/{layout,page,loading}.tsx
    cart/{layout,page,loading}.tsx
    checkout/{layout,page,loading}.tsx
    checkout/thank-you/{layout,page,loading}.tsx
    track/{layout,page,loading}.tsx
    about/{layout,page}.tsx
    contact/{layout,page,loading}.tsx
    refer/{layout,page,loading}.tsx
    riders/{layout,page,loading}.tsx
    faq/{layout,page}.tsx
    policies/[slug]/{layout,page}.tsx
  (auth)/
    layout.tsx
    login/page.tsx
    register/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
  (portal)/                             customer account - kind === "CUSTOMER"
    layout.tsx                          shell + session gate (NO db queries)
    account/{layout,page,loading,error}.tsx
    account/orders/{layout,page,loading,error}.tsx
    account/orders/[id]/{layout,page,loading}.tsx
    account/addresses/{layout,page,loading}.tsx
    account/referrals/{layout,page,loading}.tsx
    account/profile/{layout,page,loading}.tsx
  (app)/                                admin console - kind === "STAFF"
    layout.tsx                          shell + session gate
    admin/{layout,page,loading,error}.tsx
    admin/orders/{layout,page,loading,error}.tsx
    admin/orders/[id]/{layout,page,loading}.tsx
    admin/products/{layout,page,loading,error}.tsx
    admin/products/[id]/{layout,page,loading}.tsx
    admin/coupons/{layout,page,loading,error}.tsx
    admin/referrals/{layout,page,loading,error}.tsx
    admin/reviews/{layout,page,loading,error}.tsx
    admin/inquiries/{layout,page,loading,error}.tsx
    admin/settings/{layout,page,loading,error}.tsx
  api/                                  see docs/sitemap.md §5
  layout.tsx  error.tsx  global-error.tsx  not-found.tsx  loading.tsx
  globals.css  robots.ts  sitemap.ts

features/
  catalog/
    index.ts
    components/{product-gallery,colourway-switcher,product-card,product-grid,
                spec-table,price-block}.tsx
    hooks/use-catalog.ts
    server/catalog.service.ts
    server/catalog.queries.ts           /shop and /product/[slug] are prefetch pages
    schemas/product.schema.ts
    catalog.ts                          client-safe colourway registry
  cart/
    index.ts
    components/{cart-drawer,cart-line-item,cart-summary,qty-stepper,coupon-field}.tsx
    hooks/use-cart.ts
    server/cart.service.ts
    server/cart-pricing.ts              subtotal, discount, shipping, tax - pure
    schemas/cart-item.schema.ts
  checkout/
    index.ts
    components/{checkout-stepper,contact-step,delivery-step,payment-step,
                order-summary-rail,pincode-field}.tsx
    hooks/use-checkout.ts
    server/checkout.service.ts
    server/payment-gateway.ts           IO client - signature verify, order create
    schemas/checkout.schema.ts
  orders/
    index.ts
    components/{order-table,order-timeline,order-detail-card,invoice-button}.tsx
    hooks/use-orders.ts
    server/orders.service.ts
    server/order-access.ts              guard - a customer sees only their own
    server/abandoned-cart.service.ts    job (cron)
    server/review-request.service.ts    job (cron)
    schemas/order.schema.ts
    emails/{order-confirmation,shipped,abandoned-cart,review-request}.ts
  referrals/
    index.ts
    components/{referral-panel,share-row,earnings-table,referral-teaser}.tsx
    hooks/use-referrals.ts
    server/referrals.service.ts
    schemas/referral.schema.ts
    emails/referral-reward.ts
  reviews/
    index.ts
    components/{review-list,review-form,rating-stars,rider-wall}.tsx
    hooks/use-reviews.ts
    server/reviews.service.ts
    schemas/review.schema.ts
  coupons/
    index.ts
    components/coupon-table.tsx
    hooks/use-coupons.ts
    server/coupons.service.ts
    schemas/coupon.schema.ts
  shipping/
    index.ts
    hooks/use-shipping.ts
    server/shipping.service.ts
    server/serviceability.ts            IO client - courier pincode API
    schemas/address.schema.ts
  inquiries/
    index.ts
    components/{contact-form,inquiry-table}.tsx
    hooks/use-inquiries.ts
    server/inquiries.service.ts
    schemas/inquiry.schema.ts
    emails/inquiry-received.ts
  account/
    index.ts
    components/{address-book,profile-form,account-overview}.tsx
    hooks/use-account.ts
    server/account.service.ts
    schemas/profile.schema.ts

components/
  ui/                                   shadcn primitives
  shared/                               data-table · page-header · status-badge ·
                                        empty-state · money · confirm-dialog ·
                                        marquee-ticker · reveal · noise-overlay ·
                                        skull-stage (the 3D hero)
  layout/                               site-header · site-footer · cart-button ·
                                        mobile-nav · admin-sidebar · admin-topbar
  providers/                            query-provider · theme-provider · motion-provider

lib/          errors · api-response · api-fetch · pagination · constants · permissions ·
              audit · notifications · queue · mailer · storage · rate-limit · api-key ·
              crypto · dates · utils · env · logger · export-csv · query-server ·
              query/mutation-with-toast · money · slug
server/       db · auth · api-handler · action-result · action-guard · cron-auth ·
              app-config · scheduler · selects
hooks/        use-debounce · use-url-state · use-row-selection · use-media-query ·
              use-scroll-progress · use-pointer-tilt · use-prefers-reduced-motion
stores/       cart-ui.store.ts · nav.store.ts        (UI state ONLY)
config/       site.ts · nav.ts
types/        index.ts · next-auth.d.ts
prisma/       schema.prisma · migrations/ · seed.ts · sync-permissions.ts
scripts/      one-off tsx maintenance scripts
docs/         dn-nextjs-standard.md · sitemap.md · folder-structure.md ·
              design-system.md · cron-jobs.md · deployment.md
e2e/          checkout.spec.ts · catalog.spec.ts · account.spec.ts
public/
  product/    skull-cutout-front.png · skull-cutout-profile.png ·
              helmet-mounted-{front,angle}.jpg · mount-orange-{front,profile,wide,angle}.jpg ·
              colorways-olive-grey.jpg · room-context.jpg · skelmet-reel.mp4

proxy.ts                fences /account*, /api/account*, /admin*, /api/admin*
instrumentation.ts      validate env, warm config, start schedulers
prisma.config.ts        schema path, migrations, seed cmd, datasource url
vitest.config.ts  playwright.config.ts  eslint.config.mjs  .prettierrc
tsconfig.json  next.config.mjs  components.json
.nvmrc  .env.example  .editorconfig  .github/workflows/ci.yml
```

## Data model sketch (`prisma/schema.prisma`)

Every model: uuid `id`, `createdAt`, `updatedAt @updatedAt`, snake_case `@@map`,
an index on every FK and every list `where`/`orderBy` column. Money is `Decimal(12,2)`
in Postgres and a **string** on the wire.

```
User(kind: STAFF|CUSTOMER, email, passwordHash, phone, referralCode)
Role · Permission · RolePermission · UserRole
Product(slug, name, description, basePrice, status)
Variant(productId, colourway, sku, price, stock, weightGrams)
MediaAsset(productId, variantId?, key, alt, sort)      stores the KEY, never a signed URL
Cart(userId?, anonymousId, expiresAt) · CartItem(cartId, variantId, qty, unitPrice)
Address(userId, line1, line2, city, state, pincode, phone)
Order(userId?, number, status, subtotal, discount, shipping, tax, total,
      email, phone, shippingAddress Json, couponId?, referralId?)
OrderItem(orderId, variantId, qty, unitPrice, nameSnapshot)
Payment(orderId, gateway, gatewayOrderId, gatewayPaymentId, status, amount)
Shipment(orderId, courier, awb, status, shippedAt, deliveredAt)
Coupon(code, kind: PERCENT|FLAT, value, minSubtotal, maxUses, usedCount, expiresAt)
Referral(referrerId, refereeEmail, orderId?, status, rewardAmount)
Review(productId, userId?, rating, title, body, status, mediaKey?)
Inquiry(name, email, phone, subject, message, status)
AuditLog(actorId?, action, module, entityId, meta, ip, userAgent)
```

Order status is a workflow, never `PATCH { status }` - each transition is
`POST /api/orders/[id]/<verb>` (or `/api/admin/orders/[id]/<verb>`) with the §5
atomic `updateMany` claim:

```
PENDING → PAID → PACKED → SHIPPED → DELIVERED
   └────→ CANCELLED            └────→ RETURNED → REFUNDED
```

## Permission scopes (`lib/constants.ts`)

`<entity>:<verb>` - the module is the entity, never a department.

```
product:read   product:write
order:read     order:write    order:refund    order:fulfil
coupon:read    coupon:write
referral:read  referral:approve
review:read    review:moderate
inquiry:read   inquiry:write
setting:read   setting:write
dashboard:read
```

Adding a scope touches five places in one commit: `PERMISSIONS` →
`PERMISSION_DEFINITIONS` → `pnpm db:sync-permissions` → `proxy.ts` ROUTE_RULES →
`config/nav.ts`.

## Build order

1. `prisma/schema.prisma` + hand-written migration → `pnpm db:migrate` → `pnpm db:generate`
2. `lib/constants.ts` - scopes, `PERMISSION_DEFINITIONS`, `ORDER_STATUS_LABELS/COLORS`
3. `features/catalog` end to end (schema → service → routes → hook → components → barrel)
4. `features/cart` → `features/checkout` → `features/orders` (the conversion spine)
5. Storefront pages `(marketing)`, then `(portal)`, then `(app)` admin
6. `features/referrals` · `reviews` · `coupons` · `shipping` · `inquiries`
7. `config/nav.ts` + `proxy.ts` → tests → `pnpm db:sync-permissions` → `pnpm validate`
