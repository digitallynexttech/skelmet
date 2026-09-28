# SKELMET - Folder Structure

How `docs/dn-nextjs-standard.md` §2-§4 is laid out in this repo. No `src/`;
`@/*` maps to `./*`. `app/` is routing only; logic lives in `features/`. This
describes what exists - see `docs/sitemap.md` for every route.

```
app/
  (marketing)/        storefront: layout (header, footer, consent, tracker), pages, loading
  (auth)/             /login, /change-password
  (app)/admin/        the staff console; layout.tsx gates the session, pages are thin
  api/                route handlers, one expression each: respond(await service(...))
  layout.tsx          fonts, metadata, the before-paint script (splash, empty cart)
  globals.css         Tailwind 4 tokens and the few global rules
  error.tsx  global-error.tsx  not-found.tsx  robots.ts  sitemap.ts

features/<domain>/
  components/         the domain's React components
  hooks/              TanStack Query hooks and zustand stores
  schemas/            zod schemas shared by the form and the service
  server/             services (import "server-only"): permission check, zod
                      parse, ok()/fail(); plus IO clients (Razorpay, Shiprocket)
  emails/             mail bodies (orders)

  account       staff login and password change
  cart          cart store, coupon box, server-side pricing
  catalog       the product registry (catalog.ts), live price/stock, product page
  checkout      checkout page, order placement, Razorpay, prefill, recent order
  coupons       admin coupons, validation
  customers     buyers
  inquiries     contact form, drop list, inbox
  invoices      tax invoice numbering and PDF
  orders        admin orders, timeline, abandoned, track, emails
  policies      policy text (policies.ts) and page
  products      admin products and stock
  reviews       moderation queue
  settings      staff and roles, runtime settings (payment, shipping, Shiprocket)
  shipping      Shiprocket client, rates, serviceability, tracking webhook
  visitors      consent, visit tracker, analytics tags, visitor admin

components/
  ui/                 primitives: button, input (Field), select, badge, data-table, ...
  shared/             money, stars, status badge, splash screen, wordmark, ...
  layout/             site header and footer, cart button, sticky buy bar, admin sidebar
  marketing/          home and product page sections, the 3D skull (skull-*)
  providers/          query provider

lib/                  helpers used by client and server: money, dates and delivery,
                      env, mailer, API envelope and fetch, rate limit, export
server/               db, auth, action guard, API handler, audit, after-response work
config/               site.ts (identity, contacts, promises), nav, shipping, invoice
hooks/                use-hydrated, use-debounce, use-url-state, use-confirm
prisma/               schema.prisma, migrations/ (hand-written SQL), seed, sync-permissions
scripts/              one-off image builders (colourways, plates, icons, brand)
public/               product photos, the skull model (skull.glb), brand marks
assets/               files the server reads at run time (invoice fonts and lockup)
test/stubs/           server-only stub for Vitest
docs/                 this file, sitemap.md, dn-nextjs-standard.md

proxy.ts              fences /admin* and /api/admin*; refuses cross-site writes
instrumentation.ts    validates the environment at boot
next.config.mjs       images, redirects, headers, NEXT_DIST_DIR
.github/workflows/    CI: lint, typecheck, test, build
```

Design mockups and source media are kept beside the repo, in
`../FILES_SKELMET/` (`website-design-mockups/`, `website-source-media/`).
