/**
 * The seller on tax invoices. HSN 3926 (plastic articles) at 18% is for the
 * accountant to confirm. Prices include GST, so invoices work the tax back out.
 */
export const invoiceConfig = {
  seller: {
    name: "GEE STAR SPINNING SOLUTIONS",
    lines: ["B-121, Sector-6, Noida-201301, U.P."],
    phones: "9811591021, 9818745945",
    udyam: "UDYAM-UP-28-0206237 (Micro/Mfgr)",
    gstin: "09AOIPJ0692M1ZG",
    state: "Uttar Pradesh",
    stateCode: "09",
    contact: "+91-9811591021",
    email: "geestarspinning@gmail.com",
    pan: "AOIPJ0692M",
  },
  /** SKM/26-27/0001: prefix, financial year, sequence. */
  numberPrefix: "SKM",
  hsn: "3926",
  gstRatePercent: 18,
  jurisdiction: "Noida",
} as const
