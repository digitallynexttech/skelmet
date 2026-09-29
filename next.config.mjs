/**
 * Sent with every response. The Content-Security-Policy is deliberately only
 * the directives that cannot break a third party: no script-src or
 * connect-src, so Razorpay's checkout, Google Analytics and Microsoft Clarity
 * keep loading and reporting as they do. What it does stop is the site being
 * framed (clickjacking the console or the payment button), a <base> tag
 * re-pointing relative URLs, and plugins.
 *
 * No form-action: Razorpay's redirect mode - which checkout.js falls back to
 * inside in-app browsers such as Instagram's - posts a form from this page to
 * Razorpay, and Chrome applies form-action to the bank redirects after it too.
 * Blocking that would fail payments; nothing on this site takes posted HTML.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
  },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
]

/**
 * Answers that carry personal data - the console's API, a buyer's saved
 * address, an order looked up by email - must never be kept by a browser or
 * a proxy between it and here.
 */
const PRIVATE_ROUTES = [
  "/api/admin/:path*",
  "/api/public/checkout/prefill",
  "/api/public/track",
  "/api/me/:path*",
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Where the build lands. `next build` overwrites this directory in place,
  // and the running server reads from it — so building over the live one
  // served 500s for the length of a build to any page whose chunks happened
  // to be half-written. Deploys therefore build into whichever of two
  // directories is not currently live and restart onto it. Both the build
  // and `next start` must be given the same value, because the chosen name
  // is recorded inside the build's own required-server-files.json.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdfkit reads its font metrics from files beside its own code, which
  // bundling would move out from under it.
  serverExternalPackages: ["pdfkit"],
  images: {
    formats: ["image/avif", "image/webp"],
    // 1280 and 1440 added to the default ladder: a full-width photo on a
    // 1366 or 1440 laptop jumped from 1200 straight to 1920 wide, a third
    // more image than the screen can show.
    deviceSizes: [640, 750, 828, 1080, 1200, 1280, 1440, 1920, 2048, 3840],
    // A week in the browser. The optimiser's cache goes with each deploy's
    // build directory, so a replaced photo is re-encoded after a deploy.
    // Not in development: a re-rendered photo sat behind the browser's copy
    // for a week there, and a normal reload does not refetch images.
    minimumCacheTTL: process.env.NODE_ENV === "development" ? 0 : 604800,
  },
  // Source maps for the browser bundles: they only download when DevTools is
  // open, and let an error in the field point at a real line. The code is
  // shipped to every visitor anyway; nothing secret is in it.
  productionBrowserSourceMaps: true,
  // CSS arrives in the HTML instead of as a second, render-blocking request:
  // Tailwind's output is small, and first visits are most of this shop's.
  experimental: {
    inlineCss: true,
  },
  // Never set typescript.ignoreBuildErrors - a broken import must fail the
  // build, not become a runtime 500. (dn-nextjs-standard §6)

  headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...PRIVATE_ROUTES.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      })),
    ]
  },

  redirects() {
    return [
      {
        // The listing page is gone: with one product it only ever forwarded
        // people to the same place. It shipped in the sitemap at priority 0.9,
        // so it is likely indexed and bookmarked - 308 hands that over to the
        // product page instead of serving a 404.
        source: "/shop",
        destination: "/product/flame-skull-mount",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
