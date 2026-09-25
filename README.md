# SKELMET

D2C storefront and staff console for a 3D-printed flame-skull motorcycle helmet
mount. Next.js 16 App Router, Prisma 7 on Postgres, Auth.js v5, Razorpay.

---

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`pnpm install` generates the Prisma client through `postinstall`.

```bash
pnpm validate       # lint + typecheck + tests
pnpm build          # prisma generate && next build
```

The storefront renders with no database. Orders, login and everything under
`/admin` need one.

---

## What is built

### Storefront

| Route                                                  | State                                         |
| ------------------------------------------------------ | --------------------------------------------- |
| `/`                                                    | Home, 19 sections                             |
| `/shop`                                                | Collection                                    |
| `/product/[slug]`                                      | Colourway switcher, qty, gallery              |
| `/cart`                                                | Live totals, qty, remove, upsell, empty state |
| `/checkout`                                            | Address, contact, coupon, COD or Razorpay     |
| `/checkout/thank-you`                                  | Confirmation and timeline                     |
| `/about` `/contact` `/refer` `/riders` `/faq` `/track` | Live                                          |
| `/policies/[slug]`                                     | privacy, terms, shipping, returns, referral   |
| `/login`                                               | One door for staff and customers              |

The cart persists to `localStorage` and survives a reload.

### Staff console

Gated twice: `proxy.ts` checks the JWT before the page renders, and every
service re-checks the permission itself, so an API call that skips the UI is
refused the same way. A signed-in customer who guesses an admin URL gets a 404,
not a 403, so the console never confirms it exists.

| Route                | What an employee does there                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/admin`             | Today: revenue, order count, pending payments, low stock, recent orders                                           |
| `/admin/orders`      | Search, filter by status, paginate                                                                                |
| `/admin/orders/[id]` | Timeline, items, customer, payment, address; pack, ship with courier and AWB, deliver, cancel and restock, refund |
| `/admin/products`    | Prices, stock in and out, publish or unpublish                                                                    |
| `/admin/coupons`     | Create, edit, activate, deactivate discount codes                                                                 |
| `/admin/referrals`   | Credit a referrer, void a referral                                                                                |
| `/admin/reviews`     | Moderation queue, publish or reject                                                                               |
| `/admin/inquiries`   | Contact form inbox, pick up and resolve                                                                           |
| `/admin/settings`    | Add employees, assign roles, reset passwords, revoke access                                                       |

Order transitions are atomic claims (`updateMany` with the expected status in
the `where`), so two employees clicking "Mark packed" at the same moment cannot
double-transition an order. Every mutation writes an audit row with the actor
and the before and after.

Stock moves by an amount in or out rather than by typing an absolute, so two
people counting the same shelf add up instead of overwriting each other. The
console refuses any role change that would leave nobody holding `setting:write`,
since that is a one-click way to lock every employee out for good.

### Payments

1. `POST /api/checkout/session` re-prices the cart **from the database**, the
   browser sends only `{sku, qty}`. It claims stock in a transaction, writes a
   `PENDING` order, and creates the gateway order.
2. The browser opens Razorpay Checkout.
3. `POST /api/checkout/verify` checks the HMAC signature and marks the order paid.
4. `POST /api/public/webhooks/razorpay` verifies its own signature over the **raw**
   body and does the same. Either can land first, both are idempotent.

Cash on delivery works with no Razorpay keys at all. With the keys blank an
online payment is refused _before_ any order is written, so nothing is left
holding stock. COD orders are packed while still `PENDING` and become paid at
delivery, which is when they start counting as revenue.

The webhook fails closed: with no `PAYMENT_WEBHOOK_SECRET` it rejects
everything rather than trusting an unsigned call.

### Shipping (Shiprocket)

`features/shipping/`, over Shiprocket's REST API directly (no SDK).

1. **Payment captured**: the order is sent to Shiprocket in the background
   (`queueShiprocketOrder`). Best effort; if it fails, step 2 sends it.
2. **Staff pack, then book** on `/admin/orders/[id]`: pick a courier from
   Shiprocket's rates, or take Shiprocket's pick. Booking assigns the AWB,
   requests the pickup, generates the manifest and the label, and the order
   becomes `SHIPPED` once the pickup is scheduled. It is resumable: an AWB is
   saved the moment it arrives, so a failed pickup is retried without asking
   for a second courier.
3. **The courier moves it**: Shiprocket's webhook (or "Refresh tracking")
   updates the shipment and moves the order to `DELIVERED`, or `RETURNED` for
   an RTO. A courier booked in the Shiprocket panel is adopted from its first
   tracking update.

Refunding an order that has not left cancels its AWB and its Shiprocket
order. The product page's pincode check asks Shiprocket which couriers reach
the pincode, and falls back to the static promise when Shiprocket is not set
up or not answering. "It has shipped" emails go out on every path.

Setup, in Shiprocket:

- **Settings > API > API Users**: create an API user. Its email must differ from
  the main login. That email and password are `SHIPROCKET_EMAIL` and
  `SHIPROCKET_PASSWORD`.
- **Settings > Pickup Addresses**: add the workshop. Its name, exactly as
  written, is `SHIPROCKET_PICKUP_LOCATION`. Orders cannot be created without it.
- **Settings > API > Webhooks**: URL `https://<host>/api/public/webhooks/shipping`,
  security token = `SHIPROCKET_WEBHOOK_TOKEN`. Shiprocket refuses URLs containing
  "shiprocket", "kartrocket", "sr" or "kr", hence the name.
- **Wallet**: booking a courier charges it, and fails while it is empty.

Box size and packed weight live in `config/shipping.ts`; couriers bill on the
larger of actual and volumetric weight, so they set the price of every
shipment. The sandbox (Settings > Sandbox) is `SHIPROCKET_API_URL=https://api-sandbox.shiprocket.in`
with the sandbox's own login.

Without the `SHIPROCKET_*` settings the console falls back to typing the
courier and AWB by hand.

---

## Database setup

PostgreSQL 16 or 17, reachable from wherever the app runs.

```bash
cp .env.example .env          # then fill in the values
pnpm db:migrate               # hand-guarded, safe to re-run
pnpm db:seed                  # DESTRUCTIVE, throwaway databases only
```

On a database that already holds real orders, run `pnpm db:migrate` only.
`db:seed` wipes the catalogue, roles and permissions. For permission changes on
live data use `pnpm db:sync-permissions`.

The seed prints a console login, `admin@skelmet.in` / `skelmet-dev` unless you
set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` first. Change it before
anything is public.

### Hosted Postgres and TLS

Aiven and most hosted Postgres present a self-signed CA. `pg` v8 now reads
`sslmode=require` as `verify-full`, which rejects that chain with
"self-signed certificate in certificate chain". Two ways out:

- `?sslmode=require&uselibpqcompat=true` restores libpq semantics. The
  connection is still encrypted, but the server identity is not verified.
- Better: download the CA from the Aiven console, commit it as
  `certs/aiven-ca.pem`, and use
  `?sslmode=verify-full&sslrootcert=./certs/aiven-ca.pem`. That encrypts and
  proves you are talking to your database rather than something in the middle.

---

## Deploying

`build` runs `prisma generate && next build`. That is not optional. A host
installs from a cached `node_modules` and never generates the client itself, so
without it `@prisma/client` exports no `PrismaClient`, every Prisma call
degrades to `any`, and type-check fails the build.

Set these on the host, not just in `.env`:

| Variable                              | Note                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                        | include `&uselibpqcompat=true` for Aiven, see TLS above |
| `AUTH_SECRET`                         | `openssl rand -base64 32`                               |
| `AUTH_URL` `NEXT_PUBLIC_SITE_URL`     | the real domain, never localhost                        |
| `PAYMENT_KEY_ID` `PAYMENT_KEY_SECRET` | live keys, not test, when you go live                   |
| `PAYMENT_WEBHOOK_SECRET`              | the webhook 401s everything until this is set           |
| `SHIPROCKET_EMAIL` `SHIPROCKET_PASSWORD` | the API user, not the main Shiprocket login          |
| `SHIPROCKET_PICKUP_LOCATION`          | the pickup address's name in Shiprocket                 |
| `SHIPROCKET_WEBHOOK_TOKEN`            | tracking updates are ignored until this is set          |
| `REQUIRE_BACKEND=1`                   | boot fails fast on a missing secret                     |

Point the Razorpay dashboard webhook at
`https://<host>/api/public/webhooks/razorpay` and subscribe to `payment.captured` and
`payment.failed`. Razorpay signs the raw body, so nothing in front of the app
may rewrite or re-encode POST bodies on that route.

Migrations do not run at build time. Run `pnpm db:migrate` against production
yourself when a release contains one.

---

## Layout

```
app/          routing only, one expression per route handler
features/     <domain>/{components,hooks,schemas,server} + index.ts barrel
components/   ui/ shared/ layout/ marketing/ providers/
lib/          framework-free helpers
server/       db, auth, guards, audit, error mapping
prisma/       schema, hand-written SQL migrations, seed
```

Routes are one expression, `respond(await service(...))`. Services return an
`ActionResult` and own their own permission guard, so the guard cannot be
skipped by calling the service from somewhere else.

---

## Not built yet

Customer `/account/*` pages, order confirmation emails, and the abandoned-cart
and review-request crons. The schema and permissions exist; the code does not.

## Content

Copy, reviews and rider quotes are written placeholders, not real customer
statements. Specs shown in brackets are unconfirmed. Replace both before launch.
The policy pages carry a visible notice that they are not legal advice.
