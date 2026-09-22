/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Never set typescript.ignoreBuildErrors — a broken import must fail the
  // build, not become a runtime 500. (dn-nextjs-standard §6)

  redirects() {
    return [
      {
        // The listing page is gone: with one product it only ever forwarded
        // people to the same place. It shipped in the sitemap at priority 0.9,
        // so it is likely indexed and bookmarked — 308 hands that over to the
        // product page instead of serving a 404.
        source: "/shop",
        destination: "/product/flame-skull-mount",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
