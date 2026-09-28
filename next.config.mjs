/**
 * Sent with every response. The Content-Security-Policy is deliberately only
 * the directives that cannot break a third party: no script-src or
 * connect-src, so Razorpay's checkout, Google Analytics and Microsoft Clarity
 * keep loading and reporting as they do. What it does stop is the site being
 * framed (clickjacking the console or the payment button), a <base> tag
 * re-pointing relative URLs, plugins, and forms posting off-site.
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
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
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
