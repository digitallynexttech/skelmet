const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ")
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""]
    .filter(Boolean)
    .join(" ")
}

/** A whole number in the Indian system: thousands, lakhs, crores. */
function inWords(n: number): string {
  if (n === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(`${inWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (rest) parts.push(belowThousand(rest))
  return parts.join(" ")
}

/** 6726 -> "Rupees Six Thousand Seven Hundred Twenty Six Only", as invoices write it. */
export function rupeesInWords(amount: number): string {
  const paise = Math.round(amount * 100)
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  return `Rupees ${inWords(rupees)}${rest ? ` and ${belowHundred(rest)} Paise` : ""} Only`
}
