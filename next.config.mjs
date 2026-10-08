/**
 * The CSP holds only directives that cannot break a third party: no script-src
 * or connect-src (Razorpay, GA, Clarity). No form-action: Razorpay's redirect
 * mode (in-app browsers) posts a form, and Chrome applies it to bank redirects.
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

/** Personal data, and payment options that differ for staff: never cached anywhere. */
const PRIVATE_ROUTES = [
  "/api/admin/:path*",
  "/api/public/checkout/prefill",
  "/api/public/checkout/options",
  "/api/public/track",
  "/api/me/:path*",
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Deploys build into the idle of two dirs. Build and `next start` need the
  // same value: it is recorded in required-server-files.json.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdfkit reads font metrics from files beside its code; bundling moves them.
  serverExternalPackages: ["pdfkit"],
  images: {
    formats: ["image/avif", "image/webp"],
    // 90 for fine-detail photos that AVIF at 75 blurs. Others round to the nearest.
    qualities: [75, 90],
    // 1280 and 1440 added so laptops do not jump from 1200 to 1920.
    deviceSizes: [640, 750, 828, 1080, 1200, 1280, 1440, 1920, 2048, 3840],
    // A week (the optimiser cache resets each deploy). 0 in dev: a reload does
    // not refetch images.
    minimumCacheTTL: process.env.NODE_ENV === "development" ? 0 : 604800,
  },
  // Only downloaded with DevTools open; nothing secret is in the client code.
  productionBrowserSourceMaps: true,
  // Saves a render-blocking request: the CSS is small and most visits are first visits.
  experimental: {
    inlineCss: true,
  },
  // Never set typescript.ignoreBuildErrors: a broken import must fail the build.

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
        // The old listing's address, likely still indexed.
        source: "/shop",
        destination: "/products",
        permanent: true,
      },
      {
        // The cart is a drawer (CartDrawer reads ?cart=open). Temporary: a way
        // in, not a moved page.
        source: "/cart",
        destination: "/?cart=open",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
