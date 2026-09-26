/**
 * The seller on SKELMET's tax invoices, and how its goods are taxed.
 *
 * SKELMET is the brand; the business that sells, and whose GSTIN the invoice
 * carries, is Gee Star Spinning Solutions - as on its own invoices.
 *
 * `hsn` and `gstRatePercent` are for the tax accountant to confirm: 3926 is
 * "other articles of plastics", which a 3D-printed plastic mount falls under,
 * at 18%. Prices on the site include GST, so the invoice works the tax back
 * out of what the customer paid rather than adding it on top.
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
  /** Invoice numbers read SKM/26-27/0001: prefix, financial year, sequence. */
  numberPrefix: "SKM",
  hsn: "3926",
  gstRatePercent: 18,
  jurisdiction: "Noida",
} as const
