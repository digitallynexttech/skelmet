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
} as const
