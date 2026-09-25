import { siteConfig } from "@/config/site"

/**
 * What a parcel looks like to the courier.
 *
 * Couriers bill on whichever is larger: the actual weight, or the volumetric
 * weight of the box (L x B x H in cm / 5000 for most Indian couriers). So these
 * numbers set the price of every shipment - a box a few centimetres too big
 * can cost more than the mount weighs.
 *
 * Both MEASURED by the shop: one mount ships in a 42.5 x 34 x 13 cm carton
 * that weighs 920 g with everything in it - mount, packing and fixings.
 *
 * That carton's volumetric weight (42.5 x 34 x 13 / 5000 = 3.76 kg) is four
 * times the real 0.92 kg, so couriers charge for 3.76 kg. The box, not the
 * mount, is what costs money: a carton cut closer to the mount is the single
 * biggest saving on shipping. Below about 4,600 cm3 (4,600 / 5000 = 0.92 kg)
 * the real weight would take over and the box stop mattering.
 *
 * A variant's own `weightGrams` (editable in the console) wins over
 * `defaultPackedWeightGrams` when it is set.
 */
/** Which courier price stands for what a shipment costs - see `fee` below. */
export type FeeBasis = "average" | "cheapest" | "recommended"

export const shippingConfig = {
  /** Outer carton for one mount, cm. Measured. More than one unit stacks on the 13 cm side. */
  box: { lengthCm: 42.5, breadthCm: 34, heightCm: 13 },
  /** Packed weight of one mount, grams: product + carton + filler + fixings. Measured. */
  defaultPackedWeightGrams: 920,
  /**
   * Stand-in pickup pincode for rate quotes, used only until
   * SHIPROCKET_PICKUP_LOCATION is set. After that, the pickup address's own
   * pincode is read from Shiprocket, since that is where the courier collects.
   */
  pickupPincode: siteConfig.address.pin,
  /**
   * What the buyer pays for shipping: nothing, unless reaching their pincode
   * costs the shop more than `aboveRupees`, in which case a flat `feeRupees`
   * per order. Worked out for the order's own parcel, from the couriers
   * Shiprocket offers, and shown at checkout before payment.
   *
   * `basis` is which courier price stands for "what it costs":
   *
   *   "average"     - the mean of every courier offered. What the shop asked
   *                   for. The premium air couriers Shiprocket always lists
   *                   pull it up: every pincode measured, the shop's own Delhi
   *                   included, averaged over Rs 300, so every order pays.
   *   "cheapest"    - the lowest offer, which is what the shop books when it
   *                   picks the courier itself. Nearby pincodes come out free
   *                   and distant ones pay.
   *   "recommended" - Shiprocket's pick, often an air courier even locally.
   *
   * When Shiprocket cannot be asked, shipping is free: an outage must not
   * charge anyone, as it must not refuse anyone.
   */
  fee: { aboveRupees: 300, feeRupees: 350, basis: "average" as FeeBasis },
} as const
