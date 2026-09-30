@AGENTS.md

# SKELMET

Storefront and staff console for one product (a flame-skull helmet mount), live at
https://www.skelmet.in. Next.js 16 App Router, React 19, Prisma 7 on Postgres,
Auth.js v5, Razorpay, Shiprocket, Tailwind 4, pnpm. `docs/dn-nextjs-standard.md`
is the house standard and wins over habit.

## Commands

- `pnpm dev` - http://localhost:3000
- `pnpm validate` - lint, typecheck, tests. Run it before every commit.
- `pnpm db:migrate` - applies `prisma/migrations` (hand-written, idempotent SQL).
  Never `prisma migrate dev`. `pnpm db:seed` wipes data: throwaway databases only.
- A second production build beside a running dev server:
  `NEXT_DIST_DIR=.next-verify pnpm build`. `next build` rewrites `tsconfig.json`
  (adds its dist dir to `include`); restore it with `git restore tsconfig.json`.

## Deploying

Push `main`, then run `skelmet-deploy` on the server (`ssh skelmet`). It resets to
`origin/main`, installs with the frozen lockfile, applies migrations, builds into
the idle of two dist dirs, starts that build on the idle of two ports (3000,
3001) and reloads nginx onto it once it answers its health check and its main
pages. The serving process is never restarted, so a deploy drops no request;
`skelmet-rollback` switches back to the previous build the same way. Check
`/api/health` afterwards. Cloudflare sits in front; nginx passes the client IP
as `X-Real-IP`.

Migrations stay additive: the old build keeps serving on the new schema until
the switch, and again after a rollback.

## Rules that are easy to break

- Routes are one expression: `withErrorHandler` + `respond(await service(...))`.
  Services own the permission check, return `ok()`/`fail()`, never throw for an
  expected failure. No Server Actions.
- Money is `Decimal(12,2)` in the database and a string on the wire. Prices,
  discounts, the shipping formula and the ₹1 minimum are business decisions: ask
  before changing any of them.
- The cookie bar is honest: a visitor who declines is counted without an IP
  address, a cookie or a link to a person. Keep it that way.
- Reviews and the rating on the storefront are the owner's to change.
- Promises, stated once in `config/site.ts` and used everywhere: dispatch within
  48 hours, delivery within 7 working days, transit damage reported within 24
  hours, refunds issued within 7 working days of approval.
- Run Prettier on the files you changed, not on directories.
- No `loading.tsx` and no `<Suspense>` around async server components in the
  storefront (`app/(marketing)`), whatever the standard says for the console.
  Those pages are prerendered, so nobody waits on them, and a boundary makes
  the saved HTML open with its fallback and carry the real content at the end:
  on a slow connection the footer paints first and is shoved down (CLS 0.3-0.6
  measured). A Suspense a client hook needs (`useSearchParams`) is fine.
- Heavy extras wait for `afterFirstInteraction` (lib/first-interaction.ts):
  the 3D skull and gtag.js. Clarity loads only after the cookie Accept.
