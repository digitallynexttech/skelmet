import type { Metadata, Viewport } from "next"
import { Anton, JetBrains_Mono, Space_Grotesk } from "next/font/google"

import { siteConfig } from "@/config/site"

import "./globals.css"

// latin-ext on the two faces prices are set in: the rupee sign (U+20B9) lives
// in that file, not in latin, so without it every price above the fold waited
// on a late, un-preloaded font request and then swapped.
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

// Small labels only, and never the largest thing on screen: not worth
// competing with the page's main image for the first round of downloads.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
  preload: false,
  fallback: ["Courier New", "monospace"],
})

/**
 * Runs as <body> is parsed, before anything in it can paint: a page load later
 * in the same session skips the splash (see components/shared/splash-screen).
 * Set on <html> so the CSS rule can hide the curtain before React exists.
 */
const SPLASH_SKIP = `try{if(sessionStorage.getItem("skm.splash")==="1")document.documentElement.setAttribute("data-splash-skip","")}catch(e){}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} · ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
    // The file's real size: a card declared smaller than its image is
    // cropped or refused by some crawlers.
    images: [siteConfig.shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
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
      // globals.css sets scroll-behavior: smooth. Without this attribute Next
      // cannot tell a deliberate choice from an accident, so it disables smooth
      // scrolling during route transitions and warns. Opting in keeps the
      // in-page anchors smooth and the console quiet.
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      // The splash script below may add data-splash-skip before hydration.
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SKIP }} />
        {children}
      </body>
    </html>
  )
}
