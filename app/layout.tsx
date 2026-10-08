import type { Metadata, Viewport } from "next"
import { Anton, JetBrains_Mono, Space_Grotesk } from "next/font/google"

import { siteConfig } from "@/lib/config/site"

import "./globals.css"

// latin-ext: the rupee sign (U+20B9) is in that subset, so prices need it preloaded.
const display = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display-loaded",
  display: "swap",
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
})

const sans = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans-loaded",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
})

// Small labels only: not preloaded, so it does not compete with the main image.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
  preload: false,
  fallback: ["Courier New", "monospace"],
})

// Runs before first paint: sets data-cart-empty on <html> when the saved cart is empty and
// this is not a Buy-now, so /checkout paints its empty state without a layout jump.
const BEFORE_PAINT = `try{var c=JSON.parse(localStorage.getItem("skelmet.cart")||"null");if(!/[?&]buy=/.test(location.search)&&!(c&&c.state&&c.state.items&&c.state.items.length))document.documentElement.setAttribute("data-cart-empty","")}catch(e){}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    // Declares the image's real size; some crawlers crop or refuse a mismatch.
    images: [siteConfig.shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [siteConfig.shareImage.url],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#07060A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      // Tells Next the smooth scrolling in globals.css is deliberate (else it warns).
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      // The script below may add data-cart-empty before hydration.
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: BEFORE_PAINT }} />
        {children}
      </body>
    </html>
  )
}
