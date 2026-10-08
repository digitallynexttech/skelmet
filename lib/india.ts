// Shared by the checkout form and the server, so they agree on what is valid.

/** States and UTs as couriers name them. Checkout picks from this: an unknown state is refused at booking. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const

export type IndianState = (typeof INDIAN_STATES)[number]

/** Lowercase letters and single spaces, with "&" read as "and". */
function simplify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Old names, common misspellings and the merged territories' former halves. */
const ALIASES: Record<string, IndianState> = {
  orissa: "Odisha",
  pondicherry: "Puducherry",
  chattisgarh: "Chhattisgarh",
  chhatisgarh: "Chhattisgarh",
  uttaranchal: "Uttarakhand",
  "new delhi": "Delhi",
  "nct of delhi": "Delhi",
  // Cloudflare's name for it.
  "national capital territory of delhi": "Delhi",
  "delhi ncr": "Delhi",
  "jammu kashmir": "Jammu and Kashmir",
  "andaman nicobar": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  telengana: "Telangana",
  tamilnadu: "Tamil Nadu",
}

const BY_NAME = new Map<string, IndianState>([
  ...INDIAN_STATES.map((s) => [simplify(s), s] as const),
  ...Object.entries(ALIASES),
])

/** The list's spelling of a state name from elsewhere (Shiprocket, old addresses), or null. */
export function matchState(name: string | null | undefined): IndianState | null {
  if (!name) return null
  return BY_NAME.get(simplify(name)) ?? null
}

/** As the Zonal Councils group the states. */
export const INDIAN_REGIONS = [
  "North India",
  "Central India",
  "East India",
  "West India",
  "South India",
  "Northeast India",
] as const

export type IndianRegion = (typeof INDIAN_REGIONS)[number]

// The island territories have no Zonal Council; they go with their coast.
const REGION_OF_STATE: Record<IndianState, IndianRegion> = {
  Chandigarh: "North India",
  Delhi: "North India",
  Haryana: "North India",
  "Himachal Pradesh": "North India",
  "Jammu and Kashmir": "North India",
  Ladakh: "North India",
  Punjab: "North India",
  Rajasthan: "North India",
  Chhattisgarh: "Central India",
  "Madhya Pradesh": "Central India",
  "Uttar Pradesh": "Central India",
  Uttarakhand: "Central India",
  Bihar: "East India",
  Jharkhand: "East India",
  Odisha: "East India",
  "West Bengal": "East India",
  "Andaman and Nicobar Islands": "East India",
  Goa: "West India",
  Gujarat: "West India",
  Maharashtra: "West India",
  "Dadra and Nagar Haveli and Daman and Diu": "West India",
  "Andhra Pradesh": "South India",
  Karnataka: "South India",
  Kerala: "South India",
  Puducherry: "South India",
  "Tamil Nadu": "South India",
  Telangana: "South India",
  Lakshadweep: "South India",
  "Arunachal Pradesh": "Northeast India",
  Assam: "Northeast India",
  Manipur: "Northeast India",
  Meghalaya: "Northeast India",
  Mizoram: "Northeast India",
  Nagaland: "Northeast India",
  Sikkim: "Northeast India",
  Tripura: "Northeast India",
}

export function regionOf(state: string | null | undefined): IndianRegion | null {
  const match = matchState(state)
  return match ? REGION_OF_STATE[match] : null
}

/** Ten digits: all Shiprocket accepts. */
export const MOBILE = /^[6-9]\d{9}$/

export const PINCODE = /^[1-9]\d{5}$/

/** Digits only, at most ten; drops a pasted +91 or leading 0. */
export function normalizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** First two digits of a GSTIN; the invoice's place of supply. */
export const GST_STATE_CODE: Record<IndianState, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
}
