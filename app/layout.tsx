import type { Metadata, Viewport } from "next"
import { Anton, JetBrains_Mono, Space_Grotesk } from "next/font/google"

import { siteConfig } from "@/config/site"

import "./globals.css"

const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
  fallback: ["Arial Narrow", "Impact", "sans-serif"],
})

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
})

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
  fallback: ["Courier New", "monospace"],
})

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
    images: [{ url: "/product/hero-skull.jpg", width: 1200, height: 675, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["/product/hero-skull.jpg"],
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
    <html lang="en-IN" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
