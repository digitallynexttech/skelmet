# SKELMET - Sitemap & Information Architecture

Product: a 3D-printed flame-skull helmet wall mount. One hero SKU, three colourways
(Blaze Orange · Militia Olive · Ghost Grey), sold direct-to-consumer in India.

Route groups follow `docs/dn-nextjs-standard.md` §2. Route groups `(x)` do **not**
appear in the URL - the URL column is what the visitor actually sees.

---

## 1. Storefront - `app/(marketing)/` · public, no session

| URL                   | Page              | Purpose                            | Key sections                                                                                                             |
| --------------------- | ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`                   | Home              | Convert cold traffic in one scroll | 3D hero · ticker · colourway picker · anatomy/spec · lifestyle · bento features · reel · rider wall · refer teaser · FAQ |
| `/shop`               | Collection        | All colourways + bundles           | Filter chips (colour, bundle), product cards, sticky "compare" bar                                                       |
| `/product/[slug]`     | Product detail    | The money page                     | Gallery + 3D spin · colourway switcher · price/qty · trust row · specs accordion · what's in the box · reviews · related |
| `/cart`               | Cart              | Review & upsell                    | Line items, qty steppers, coupon field, order summary, "add a second mount" upsell                                       |
| `/checkout`           | Checkout          | Single-page, 3 collapsible steps   | Contact → Delivery (pincode check) → Payment. Sticky order summary                                                       |
| `/checkout/thank-you` | Thank you         | Post-order confirmation            | Order id, ETA, what happens next, share-to-earn referral hook, track button                                              |
| `/track`              | Track order       | Order-id + email lookup, no login  | Status timeline                                                                                                          |
| `/about`              | About us          | Founder story, why 3D printing     | Origin, the print farm, materials, sustainability                                                                        |
| `/contact`            | Contact us        | Support + wholesale                | Form, WhatsApp/email, response-time promise, FAQ deflection                                                              |
| `/refer`              | Refer & Earn      | Referral programme landing         | How it works (3 steps), reward tiers, share panel, T&C                                                                   |
| `/riders`             | Rider wall        | UGC / social proof gallery         | Grid of customer photos, submit-yours CTA                                                                                |
| `/faq`                | FAQ               | Long-form support                  | Grouped accordions: shipping, fitment, install, returns                                                                  |
| `/policies/shipping`  | Shipping policy   | Legal / trust                      | -                                                                                                                        |
| `/policies/returns`   | Returns & refunds | Legal / trust                      | -                                                                                                                        |
| `/policies/privacy`   | Privacy policy    | Legal / trust                      | -                                                                                                                        |
| `/policies/terms`     | Terms of service  | Legal / trust                      | -                                                                                                                        |

Plus route files: `app/sitemap.ts`, `app/robots.ts`, `app/not-found.tsx`.

## 2. Auth - `app/(auth)/`

| URL                | Page                                                           |
| ------------------ | -------------------------------------------------------------- |
| `/login`           | Email + password / OTP sign-in (customers and staff, one form) |
| `/register`        | Create account (optional - guest checkout is the default path) |
| `/forgot-password` | Request reset link                                             |
| `/reset-password`  | Consume reset token                                            |

## 3. Customer account - `app/(portal)/` · `session.user.kind === "CUSTOMER"`

The standard's §6 "second population" pattern. The prefix is `/account*` rather than
`/portal*`; `proxy.ts` fences `/account*` and `/api/account*` in both directions.

| URL                    | Page                                                     |
| ---------------------- | -------------------------------------------------------- |
| `/account`             | Overview - latest order, referral balance, saved address |
| `/account/orders`      | Order list                                               |
| `/account/orders/[id]` | Order detail - timeline, invoice, reorder                |
| `/account/addresses`   | Address book                                             |
| `/account/referrals`   | Referral code, invite log, earnings, payout request      |
| `/account/profile`     | Name, phone, password, marketing prefs                   |

## 4. Admin console - `app/(app)/` · `session.user.kind === "STAFF"`

The authenticated product. Fenced at `/admin*` and `/api/admin*` by `proxy.ts`
ROUTE_RULES, enforced again by `requirePermission` in every service.

| URL                                        | Page                                           | Scope                        |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------- |
| `/admin`                                   | Dashboard - today's orders, revenue, low stock | `dashboard:read`             |
| `/admin/orders` · `/admin/orders/[id]`     | Order queue, fulfilment, refunds               | `order:read` / `order:write` |
| `/admin/products` · `/admin/products/[id]` | Catalogue, variants, stock, media              | `product:write`              |
| `/admin/coupons`                           | Discount codes                                 | `coupon:write`               |
| `/admin/referrals`                         | Referral ledger, payout approvals              | `referral:approve`           |
| `/admin/reviews`                           | Moderate reviews & UGC                         | `review:moderate`            |
| `/admin/inquiries`                         | Contact-form inbox                             | `inquiry:read`               |
| `/admin/settings`                          | Shipping rates, thresholds, banner copy        | `setting:write`              |

## 5. API - `app/api/`

```
api/products/route.ts                   GET list
api/products/[id]/route.ts              GET one
api/cart/route.ts                       GET · DELETE (clear)
api/cart/items/route.ts                 POST add
api/cart/items/[id]/route.ts            PATCH qty · DELETE
api/coupons/validate/route.ts           POST
api/shipping/serviceability/route.ts    POST pincode -> ETA + rate
api/checkout/session/route.ts           POST create payment order
api/orders/route.ts                     GET list (own) · POST place
api/orders/[id]/route.ts                GET one
api/orders/[id]/cancel/route.ts         POST  (atomic claim, §5)
api/referrals/route.ts                  GET own code + ledger
api/referrals/redeem/route.ts           POST apply a code
api/reviews/route.ts                    GET list · POST create
api/account/addresses/route.ts          GET · POST
api/account/addresses/[id]/route.ts     PATCH · DELETE
api/admin/orders/[id]/fulfil/route.ts   POST
api/admin/orders/[id]/refund/route.ts   POST
api/admin/orders/[id]/couriers/route.ts GET   Shiprocket rates for the order
api/admin/orders/[id]/book/route.ts     POST  book courier: AWB, pickup, manifest, label
api/admin/orders/[id]/tracking/route.ts POST  pull the latest tracking from Shiprocket
api/public/track/route.ts               POST  order-id + email, rate-limited
api/public/shipping/pincode/route.ts    GET   courier reach + transit days, rate-limited
api/public/webhooks/shipping/route.ts   POST  Shiprocket tracking, x-api-key token
api/public/contact/route.ts             POST  rate-limited + API-key free
api/public/webhooks/razorpay/route.ts   POST  gateway callback, signature-verified
api/cron/abandoned-cart/route.ts        assertCron - nudge email at T+4h
api/cron/review-request/route.ts        assertCron - T+7d after delivery
api/health/route.ts                     { ok, db, version }
```

## 6. Primary conversion path

```
/  ──▶  /product/skelmet-flame-mount  ──▶  /cart  ──▶  /checkout  ──▶  /checkout/thank-you
                    │                                                          │
                    └── colourway switch (no navigation)                        └──▶ /refer  (share-to-earn hook)
```

Secondary loops: `/riders` → `/product/[slug]` (social proof → PDP) and
`/checkout/thank-you` → `/account/referrals` (post-purchase advocacy).
