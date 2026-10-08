export const siteConfig = {
  name: "SKELMET",
  tagline: "Park the menace",
  description:
    "A flame-skull wall mount for riders who sweat the details. Holds the helmet, hooks the gloves, and looks considerably better than the floor. Made in India.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // A sole proprietorship trading as SKELMET, not a company.
  legalEntity: "Gee Star Spinning Solutions",
  legalForm: "sole proprietorship",
  gstin: "09AOIPJ0692M1ZG",
  city: "Noida",
  email: "contact@skelmet.in",
  supportEmail: "contact@skelmet.in",
  grievanceEmail: "contact@skelmet.in",
  phone: "+91 98187 45945",
  address: {
    line1: "B-121, B Block, Udyog Marg, Sector 6",
    city: "Noida, Gautam Buddha Nagar, Uttar Pradesh",
    pin: "201301",
  },

  social: {
    instagram: "https://www.instagram.com/skelmet.in/",
    /** As it is written on the site: "tag @skelmet.in". */
    instagramHandle: "@skelmet.in",
    youtube: "https://youtube.com/@skelmet",
    whatsapp: "https://wa.me/919818745945",
  },

  // Analytics ids are public (in every page's source), so they live here.
  // Loaded by production builds only.
  googleAnalyticsId: "G-7VCRHFQV1R",

  clarityProjectId: "ypbnwozfgy",

  /** Only for visitors who accept cookies. */
  metaPixelId: "1023005070753961",

  /** Public ids. Empty `projectId`: the blog is empty and out of the menu. */
  sanity: {
    projectId: "j1yocufx" as string,
    dataset: "production" as string,
    apiVersion: "2025-02-19",
  },

  /** Default share card. A page setting its own openGraph replaces it, so passes this back in. */
  shareImage: { url: "/product/hero-skull.jpg", width: 2000, height: 1116, alt: "SKELMET" },

  /**
   * The shop's promises, quoted everywhere. Dispatch counts from payment,
   * delivery from dispatch, refunds from approval (bank time on top).
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
