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
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Never set typescript.ignoreBuildErrors - a broken import must fail the
  // build, not become a runtime 500. (dn-nextjs-standard §6)

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
