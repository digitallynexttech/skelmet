/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Never set typescript.ignoreBuildErrors — a broken import must fail the
  // build, not become a runtime 500. (dn-nextjs-standard §6)
}

export default nextConfig
