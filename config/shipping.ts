import { siteConfig } from "@/config/site"

// Couriers bill the larger of real and volumetric weight (L x B x H cm / 5000),
// so the carton's size, not the mount, sets the price.

/** Which courier price stands for a shipment's cost; see `fee`. */
export const FEE_BASES = ["twoCheapest", "average", "cheapest", "recommended"] as const
export type FeeBasis = (typeof FEE_BASES)[number]

export const shippingConfig = {
  /** Outer carton for one mount, cm, measured. More units stack on the 13 cm side. */
  box: { lengthCm: 42.5, breadthCm: 34, heightCm: 13 },
  /** Packed weight of one mount, grams, measured. A variant's `weightGrams` wins. */
  defaultPackedWeightGrams: 920,
  /** For rate quotes until SHIPROCKET_PICKUP_LOCATION is set; then that address's pincode. */
  pickupPincode: siteConfig.address.pin,
  /**
   * Owner's rule: free unless the courier costs more than `aboveRupees`, then the
   * buyer pays `sharePercent` of the excess, rounded (300, 50%: Rs 500 costs Rs 100).
   * If Shiprocket cannot be asked, shipping is free. `basis`: "twoCheapest" (the
   * shop's choice: mean of the two lowest offers), "average", "cheapest", or
   * "recommended" (Shiprocket's pick). Defaults; Settings > Shipping overrides.
   */
  fee: { aboveRupees: 300, sharePercent: 50, basis: "twoCheapest" as FeeBasis },
} as const
