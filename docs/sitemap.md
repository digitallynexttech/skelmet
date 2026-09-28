# SKELMET - Sitemap

Product: a 3D-printed flame-skull helmet wall mount. One product, three colourways
(Blaze Orange · Militia Olive · Ghost Grey), sold direct to consumers in India.

Route groups `(x)` do **not** appear in the URL; the URL column is what the visitor
sees. This lists what exists. Anything not here is not built.

---

## 1. Storefront - `app/(marketing)/` · public, no session

| URL                   | Page        | What is on it                                                                                                               |
| --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | Home        | 3D hero · ticker · trust strip · lineup · features · anatomy · finish · comparison · rider wall · reviews · FAQ · drop list |
| `/product/[slug]`     | Product     | Gallery · colourway switcher · price and qty · pincode check · Buy now · product information · the sections below           |
| `/cart`               | Cart        | Lines, quantity, coupon, summary                                                                                            |
| `/checkout`           | Checkout    | Contact → delivery (pincode) → payment (Razorpay). `?buy=<colourway>&qty=<n>` buys one line, cart untouched                 |
| `/checkout/thank-you` | Thank you   | The order as it stands: paid, payment processing, or cancelled                                                              |
| `/track`              | Track order | Order number + email, no login                                                                                              |
| `/about`              | About       | Why the mount exists, how it is made                                                                                        |
| `/contact`            | Contact     | The business (legal name, address, GSTIN), form with `?topic=` preselect, email, phone                                      |
| `/riders`             | Rider wall  | Photos of the mount in use                                                                                                  |
| `/faq`                | FAQ         | Fitment, drilling, shipping, returns, payment                                                                               |
| `/policies/[slug]`    | Policies    | `privacy`, `terms`, `shipping`, `returns` (returns, refunds and cancellation)                                               |

`/shop` redirects to the product page. Route files: `app/sitemap.ts`,
`app/robots.ts`, `app/not-found.tsx`, `app/error.tsx`.

## 2. Auth - `app/(auth)/`

| URL                | Page                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `/login`           | Staff sign-in. There are no customer accounts                      |
| `/change-password` | Forced after a temporary password; also reachable from the console |

## 3. Admin console - `app/(app)/` · staff only

Fenced at `/admin*` and `/api/admin*` by `proxy.ts`, enforced again by
`requirePermission` in every service. A visitor without the permission gets a 404.

| URL                                  | Page                                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| `/admin`                             | Dashboard: today's revenue and orders, low stock, recent        |
| `/admin/orders`                      | Paid orders and every stage after                               |
| `/admin/orders/all`                  | Every order, paid or not                                        |
| `/admin/orders/abandoned`            | Unpaid orders and carts left behind                             |
| `/admin/orders/[id]`                 | One order: pack, book a courier, ship, deliver, refund, invoice |
| `/admin/customers` · `[id]`          | Buyers                                                          |
| `/admin/customers/visitors` · `[id]` | Visits, page by page                                            |
| `/admin/products`                    | Prices, stock, publish                                          |
| `/admin/coupons`                     | Discount codes                                                  |
| `/admin/reviews`                     | Review moderation                                               |
| `/admin/inquiries`                   | Contact form and drop-list inbox                                |
| `/admin/settings`                    | Staff and roles, payment keys, shipping, Shiprocket             |

## 4. API - `app/api/`

```
health/route.ts                          GET  { ok, db }
auth/[...nextauth]/route.ts              Auth.js
me/password/route.ts                     POST change own password

products/route.ts · products/[slug]      GET  catalogue with live price and stock
coupons/validate/route.ts                POST preview a code, rate-limited
checkout/session/route.ts                POST price, claim stock, open the order and the gateway order
checkout/verify/route.ts                 POST confirm a Razorpay payment, rate-limited

public/checkout/prefill/route.ts         GET  last address on this device, rate-limited
public/contact/route.ts                  POST contact form and drop list, rate-limited
public/shipping/pincode/route.ts         GET  reach and fee for a pincode, rate-limited
public/track/route.ts                    POST order number + email, rate-limited
public/visits/route.ts                   POST visit tracker
public/webhooks/razorpay/route.ts        POST payment events, signature-verified
public/webhooks/shipping/route.ts        POST Shiprocket tracking, token-checked

admin/dashboard/route.ts                 GET
admin/orders/route.ts · [id]             GET
admin/orders/[id]/pack|ship|deliver|cancel|refund   POST  atomic status claims
admin/orders/[id]/couriers               GET  Shiprocket rates
admin/orders/[id]/book                   POST AWB, pickup, manifest, label
admin/orders/[id]/tracking               POST pull the latest tracking
admin/orders/[id]/invoice                GET  tax invoice PDF
admin/orders/[id]/invoice/email          POST email it to the buyer
admin/orders/abandoned · admin/carts     GET
admin/customers · [id]                   GET
admin/visitors · [id]                    GET
admin/products · [id]                    GET · PATCH
admin/variants/[id] · [id]/stock         PATCH · POST stock in/out
admin/coupons · [id]                     GET · POST · PATCH
admin/reviews · [id]/publish|reject      GET · POST
admin/inquiries · [id]                   GET · PATCH
admin/staff · [id] · [id]/password       GET · POST · PATCH · DELETE
admin/settings · payment · shipping · shiprocket (+ /test)   GET · PATCH · POST
```

## 5. Conversion path

```
/  ──▶  /product/flame-skull-mount  ──▶  /cart  ──▶  /checkout  ──▶  /checkout/thank-you
                  │                                      ▲
                  └── Buy now ───────────────────────────┘  (one line, cart untouched)
```
