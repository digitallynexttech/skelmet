export const siteConfig = {
  name: "SKELMET",
  tagline: "Park the menace",
  description:
    "A flame-skull wall mount for riders who sweat the details. Holds the helmet, hooks the gloves, and looks considerably better than the floor. Made in India.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // [TO CONFIRM]: real values before launch
  legalEntity: "Gee Star Spinning Solutions",
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

  promise: {
    dispatchHours: 48,
    returnDays: 7,
    deliveryDays: "7 working days",
    warrantyMonths: 6,
  },
} as const

export type SiteConfig = typeof siteConfig
