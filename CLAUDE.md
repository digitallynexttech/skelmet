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
the idle of two dist dirs, starts that build on whichever of ports 3000 and 3001
is idle, and reloads nginx onto it once it answers its health check and its main
pages. The serving process is never restarted, so a deploy drops no request;
`skelmet-rollback` switches back to the previous build the same way. Check
`/api/health` afterwards. Cloudflare sits in front; nginx passes the client IP
as `X-Real-IP`.

Migrations stay additive: the old build keeps serving on the new schema until
the switch, and again after a rollback.

## Blog

Posts live in Sanity, not in the database. The project is named in
`config/site.ts` (`sanity.projectId`); with none, `/blog` is empty and out
of the menu. Editors write at `/studio`, which signs them in through Sanity.
`features/blog/server/sanity.ts` reads posts and Next keeps them for a
minute, so publishing needs no deploy. `proxy.ts` answers 404 for a
`/blog/<slug>` that is not a post (`features/blog/server/known-posts.ts`).
Pictures come straight from Sanity's image CDN, not this server's optimiser.

Scheduling has no timer behind it. A scheduled post is published in Sanity
at once with a `publishedAt` still to come, and every read leaves out a post
whose date has not arrived (`isLive`) - checked in this code, not in the
query, because Sanity's CDN would cache "before now". The console's Blog page
(`features/blog/server/blog.service.ts`) publishes, schedules and takes posts
down; it needs `SANITY_API_TOKEN` with the Editor role, and repeats the
Studio's required-field checks because it publishes round the Studio.

## The hero skull

`components/marketing/skull-*`. The scene (three.js, the model, every draw)
runs in a worker on a canvas handed over to it (`skull-scene`, `skull-worker`);
`skull-renderer` starts it once and keeps it, canvas and all, for the life of
the page, and keeps the model's bytes in Cache Storage for the next visit. A
browser that cannot give a worker a WebGL canvas runs the same scene on the
main thread. `skull-canvas` does only what needs the document: it hands the
skull's whole route down the page to the browser as a scroll-driven animation,
so the box is moved by the compositor, and tells the scene how the skull is
turned. `skull-optics` is the camera as plain arithmetic, shared by both sides
and held to three.js by a test.

The poster in the hero is a frame of that scene and has to stay one. After
changing the model, the lights or the camera, run
`node scripts/build-hero-poster.mjs` against `pnpm dev`. It names the new file
by its contents and deletes the one before it: put that one back
(`git checkout`) for one release, because the build still serving during a
deploy asks for it.

The splash screen's wordmark and count are CSS animations of `transform` only
(globals.css), so they run off the main thread and start before any script.
Keep them that way: the splash is up while the page hydrates.

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
  the 3D skull - on a first visit; a browser that already holds the model
  starts it at once - and gtag.js. Clarity loads only after the cookie Accept.
- Nothing may make a page wider than the screen, even for a moment. A phone
  then lays out everything `fixed` - the splash, the cookie card, the floating
  buttons - against the wider page, off centre and partly off screen. `<main>`
  clips sideways overflow for that reason; anything portalled outside it has
  to clip itself.
