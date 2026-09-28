export const siteConfig = {
  name: "SKELMET",
  tagline: "Park the menace",
  description:
    "A flame-skull wall mount for riders who sweat the details. Holds the helmet, hooks the gloves, and looks considerably better than the floor. Made in India.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // The business behind the shop, as the policies, the footer and /contact
  // name it: a sole proprietorship trading as SKELMET, not a company.
  legalEntity: "Gee Star Spinning Solutions",
  legalForm: "sole proprietorship",
  gstin: "09AOIPJ0692M1ZG",
  city: "Noida",
  email: "skelmetindia@gmail.com",
  supportEmail: "skelmetindia@gmail.com",
  grievanceEmail: "skelmetindia@gmail.com",
  phone: "+91 98187 45945",
  address: {
    line1: "B-121, B Block, Udyog Marg, Sector 6",
    city: "Noida, Gautam Buddha Nagar, Uttar Pradesh",
    pin: "201301",
  },

  social: {
    instagram: "https://instagram.com/skelmet",
    youtube: "https://youtube.com/@skelmet",
    whatsapp: "https://wa.me/919818745945",
  },

  /**
   * Google Analytics 4. Public by nature - it is in every page's source - so
   * it lives here rather than in the environment. Loaded by production builds
   * only, so a laptop running `pnpm dev` never counts itself as a visitor.
   */
  googleAnalyticsId: "G-7VCRHFQV1R",

  /** Microsoft Clarity (heatmaps and session recordings). Public, like the GA id. */
  clarityProjectId: "ypbnwozfgy",

  /**
   * The share card every page falls back to. Pages that set their own
   * openGraph replace the root layout's whole object, image included, so they
   * pass this back in rather than lose it.
   */
  shareImage: { url: "/product/hero-skull.jpg", width: 2000, height: 1116, alt: "SKELMET" },

  /**
   * What the shop promises, quoted on the policies, the FAQ, checkout and the
   * emails. Dispatch counts from payment; delivery counts from dispatch.
   * Refunds count from the return (or cancellation) being approved, and the
   * bank adds its own time on top.
   */
  promise: {
    dispatchHours: 48,
    returnDays: 7,
    deliveryDays: "7 working days",
    warrantyMonths: 6,
    damageReportHours: 24,
    refundDays: "7 working days",
    bankDays: "5-7 working days",
    supportReply: "one working day",
    grievanceAckHours: 48,
    grievanceResolution: "one month",
  },
} as const

export type SiteConfig = typeof siteConfig
