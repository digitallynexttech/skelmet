export const siteConfig = {
  name: "SKELMET",
  tagline: "Park the menace",
  description:
    "A flame-skull wall mount for riders who sweat the details. Holds the helmet, hooks the gloves, and looks considerably better than the floor. Made in India.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  // [TO CONFIRM]: real values before launch
  legalEntity: "[LEGAL ENTITY NAME]",
  gstin: "[GSTIN]",
  city: "[CITY]",
  email: "[hello@skelmet.in]",
  supportEmail: "[support@skelmet.in]",
  grievanceEmail: "[grievance@skelmet.in]",
  phone: "[+91 XXXXX XXXXX]",
  address: {
    line1: "[STREET ADDRESS]",
    city: "[CITY, STATE]",
    pin: "[PIN]",
  },

  social: {
    instagram: "https://instagram.com/skelmet",
    youtube: "https://youtube.com/@skelmet",
    whatsapp: "https://wa.me/91XXXXXXXXXX",
  },

  promise: {
    dispatchHours: 48,
    returnDays: 7,
    deliveryDays: "3–6 working days",
    warrantyMonths: 12,
  },
} as const

export type SiteConfig = typeof siteConfig
