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

| Route                                         | State                                               |
| --------------------------------------------- | --------------------------------------------------- |
| `/`                                           | Home: 3D hero, lineup, features, reviews, FAQ       |
| `/product/[slug]`                             | Colourway switcher, qty, gallery, pincode check     |
| cart drawer (any page; `/cart` opens it)      | Live totals, qty, remove, coupon, empty state       |
| `/checkout`                                   | Contact, address, coupon, Razorpay; Buy now too     |
| `/checkout/thank-you`                         | The order as it stands: paid, processing, cancelled |
| `/about` `/contact` `/riders` `/faq` `/track` | Live                                                |
| `/policies/[slug]`                            | privacy, terms, shipping, returns                   |
| `/login`                                      | Staff only. There are no customer accounts          |

`/shop` redirects to the product page. The cart persists to `localStorage`
and survives a reload.

### Staff console

Gated twice: `proxy.ts` checks the JWT before the page renders, and every
service re-checks the permission itself, so an API call that skips the UI is
refused the same way. A signed-in customer who guesses an admin URL gets a 404,
not a 403, so the console never confirms it exists.

| Route                            | What an employee does there                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/admin`                         | Today: revenue, order count, pending payments, low stock, recent orders                                           |
| `/admin/orders`                  | Paid orders and every stage after (packed, shipped, delivered, returned, refunded); search, filter by status      |
| `/admin/orders/all`              | Every order, paid or not, including those awaiting payment and cancelled unpaid                                   |
| `/admin/orders/[id]`             | Timeline, items, customer, payment, address; pack, ship with courier and AWB, deliver, cancel and restock, refund |
| `/admin/orders/abandoned`        | Orders placed and never paid (and whether the buyer paid later), carts left behind; WhatsApp, call or email them  |
| `/admin/customers`               | Buyers: everyone who has paid for an order                                                                        |
| `/admin/customers/visitors`      | Everyone who browsed: device, city, source, pages, time on site, cart; IP and contact when they accepted cookies  |
| `/admin/customers/visitors/[id]` | One visitor, visit by visit, page by page                                                                         |
| `/admin/products`                | Prices, stock in and out, publish or unpublish                                                                    |
| `/admin/coupons`                 | Create, edit, activate, deactivate discount codes                                                                 |
| `/admin/reviews`                 | Moderation queue, publish or reject                                                                               |
| `/admin/inquiries`               | Contact form inbox, pick up and resolve                                                                           |
| `/admin/settings`                | Add employees, assign roles, reset passwords, revoke access                                                       |

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

Payment is online only. With the keys blank a payment is refused _before_ any
order is written, so nothing is left holding stock. Cash on delivery has been
withdrawn; orders placed as COD before that still show and invoice as COD.

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

Box size and packed weight live in `lib/config/shipping.ts`; couriers bill on the
larger of actual and volumetric weight, so they set the price of every
shipment. The sandbox (Settings > Sandbox) is `SHIPROCKET_API_URL=https://api-sandbox.shiprocket.in`
with the sandbox's own login.

Without the `SHIPROCKET_*` settings the console falls back to typing the
courier and AWB by hand.

### Visitors and abandoned carts

`features/visitors/`. Every storefront page runs a small tracker
(`lib/tracker.ts`) that posts to `POST /api/public/visits`: page views, the
time actually spent on each page, the cart as it changes, the basket that
reaches checkout, and the order it becomes. The server half is
`server/tracking.service.ts`. What it keeps depends on the cookie bar:

- **Accepted**: a year-long httpOnly cookie (`skm.vid`) recognises the device.
  Its row holds the IP address, the phone model, where the visitor first came
  from, and the email, phone, name and pincode typed at checkout, even when
  no order is placed. The visitor is linked to their orders.
- **Decline, or no answer yet**: the visit is still counted (pages,
  time, device type, city, source, cart), but with no cookie and no IP
  address, and it is never linked to a person or an order.
- **Changed their mind** (Cookie settings in the footer): the cookie is
  removed and the IP address and contact details are wiped from their record.

Bots and signed-in staff are never counted, so to see yourself as a visitor,
sign out of the console or use a private window.

Unpaid orders are cancelled after an hour to put their stock back on sale.
Orders lists only paid orders; All orders keeps the unpaid and cancelled ones,
and `/admin/orders/abandoned` (Abandoned carts) follows them up, says whether the buyer came
back and paid on a later order, and lists the carts nobody checked out.

The city, region and pincode area come from Cloudflare. Switch on **Rules >
Transform Rules > Managed Transforms > Add visitor location headers** for the
site, or only the country is known. Visits are deleted a year after they
happen and copied carts 90 days after they last changed, as the privacy policy
says; with no scheduler on this server, that runs when staff open these
screens.

---

## Database setup

PostgreSQL 16 or 17, reachable from wherever the app runs.

```bash
# first: a .env with the variables listed under Deploying
pnpm db:migrate               # hand-guarded, safe to re-run
pnpm db:bootstrap             # adds only what is missing; safe on live data
```

`db:bootstrap` creates the permissions, the Admin role, the first administrator
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, who must choose a new password at
first sign-in) and the product at stock 0. It never changes an existing
password, price or stock. When a release adds permissions, run
`pnpm db:sync-permissions` on the live database.

`pnpm db:seed` is for a throwaway local database: it wipes the catalogue,
roles and orders only with `SEED_RESET=1`, and refuses a non-local host.

### Hosted Postgres and TLS

Aiven and most hosted Postgres present a self-signed CA. `pg` v8 now reads
`sslmode=require` as `verify-full`, which rejects that chain with
"self-signed certificate in certificate chain". Two ways out:

- `?sslmode=require&uselibpqcompat=true` restores libpq semantics. The
  connection is still encrypted, but the server identity is not verified.
- Better: download the CA from the Aiven console, keep it on the server
  outside the repo (`*.pem` is git-ignored: a CA is configuration, not
  source), and use `?sslmode=verify-full&sslrootcert=/absolute/path/ca.pem`.
  That encrypts and proves you are talking to your database rather than
  something in the middle.

---

## Deploying

`build` runs `prisma generate && next build`. That is not optional. A host
installs from a cached `node_modules` and never generates the client itself, so
without it `@prisma/client` exports no `PrismaClient`, every Prisma call
degrades to `any`, and type-check fails the build.

Set these on the host, not just in `.env`:

| Variable                                            | Note                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                                      | include `&uselibpqcompat=true` for Aiven, see TLS above                 |
| `AUTH_SECRET`                                       | `openssl rand -base64 32`                                               |
| `AUTH_URL` `NEXT_PUBLIC_SITE_URL`                   | the real domain, never localhost                                        |
| `PAYMENT_KEY_ID` `PAYMENT_KEY_SECRET`               | live keys, not test, when you go live                                   |
| `PAYMENT_WEBHOOK_SECRET`                            | the webhook 401s everything until this is set                           |
| `SHIPROCKET_EMAIL` `SHIPROCKET_PASSWORD`            | the API user, not the main Shiprocket login                             |
| `SHIPROCKET_PICKUP_LOCATION`                        | the pickup address's name in Shiprocket                                 |
| `SHIPROCKET_WEBHOOK_TOKEN`                          | tracking updates are ignored until this is set                          |
| `SANITY_API_TOKEN`                                  | the console's Blog page (Editor role); a private dataset                |
| `BREVO_API_KEY`                                     | mail's first route: Brevo's API                                         |
| `BREVO_SMTP_LOGIN` `BREVO_SMTP_KEY`                 | mail's second route: Brevo's SMTP relay                                 |
| `BREVO_FROM`                                        | Brevo's sender, on a domain authenticated in Brevo                      |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` | mail's last route, the shop's Gmail; with no route set, mail is skipped |
| `MAIL_FROM`                                         | the Gmail route's From line: that Gmail mailbox                         |
| `MAIL_REPLY_TO`                                     | where replies go on every route                                         |
| `REQUIRE_BACKEND=1`                                 | boot fails fast on a missing secret                                     |
| `NEXT_DIST_DIR`                                     | the build directory; the deploy alternates two                          |

Point the Razorpay dashboard webhook at
`https://<host>/api/public/webhooks/razorpay` and subscribe to `payment.captured` and
`payment.failed`. Razorpay signs the raw body, so nothing in front of the app
may rewrite or re-encode POST bodies on that route.

Migrations do not run inside `next build`. On the production server,
`skelmet-deploy` resets to `origin/main`, installs with the frozen lockfile,
runs `pnpm db:migrate` and builds into whichever of two dist directories is
idle. It then starts that build on whichever of two ports (3000, 3001) is
idle, and reloads nginx onto it only once it answers its health check and its
main pages - the process that is serving is never restarted, so a deploy
drops no request and a failed one leaves the live build untouched. nginx
serves `/_next/static` from disk, from the live build and the one before it,
so a page opened before a deploy still finds its scripts. `skelmet-rollback`
puts the previous build back the same way. Migrations have to stay additive:
the old build runs on the new schema until the switch.

---

## Layout

```
app/          routing only, one expression per route handler
features/     <domain>/{components,hooks,schemas,server,emails}
components/   ui/ shared/ layout/ marketing/ providers/
lib/          helpers for client and server: money, dates, env, mail, API envelope
lib/config/   the site's facts: promises, contact, shipping box, invoice seller, nav
server/       db, auth, guards, audit, error mapping
prisma/       schema, hand-written SQL migrations, seed
public/       images, the invoice's fonts and logo (public/invoice)
scripts/      asset builders and the mail test, run by hand
```

Features are imported by path (`@/features/cart/hooks/use-cart`). There are no
`index.ts` barrels: one would pull a feature's server code into client bundles.

Routes are one expression, `respond(await service(...))`. Services return an
`ActionResult` and own their own permission guard, so the guard cannot be
skipped by calling the service from somewhere else.

---

## Not built

- Customer accounts. Buyers check out as guests and follow an order on
  `/track`; the customer tables hold their details, not logins.
- Scheduled jobs. There is no cron on this server: unpaid orders past their
  hour are released when the next checkout starts or staff open the order
  screens, and old visits and carts are deleted when staff open theirs.

## Content

The storefront's rating, review count and review quotes are set in code
(`features/catalog/catalog.ts`, `components/marketing/content.ts`), not read
from the reviews table. The shop's promises (dispatch, delivery, damage window,
refunds, support replies) are stated once, in `siteConfig.promise` in
`lib/config/site.ts`, and quoted from there by the policies, FAQ, checkout and
emails.
