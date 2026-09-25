import { siteConfig } from "@/config/site"

/**
 * What a parcel looks like to the courier.
 *
 * Couriers bill on whichever is larger: the actual weight, or the volumetric
 * weight of the box (L x B x H in cm / 5000 for most Indian couriers). So these
 * numbers set the price of every shipment - a box a few centimetres too big
 * can cost more than the mount weighs.
 *
 * [TO CONFIRM]: these are estimates, not measurements. Measure a packed box and
 * weigh it, then replace them. How they were estimated:
 *
 *   The mount ships as one piece, skull and arm together. Scaled from the
 *   side-on product shot (public/product/mount-assembled.jpg) against a skull
 *   of about 16 cm, it is roughly 30 cm long, 24 cm tall and 14 cm across the
 *   skull. The carton allows about a centimetre of padding each way.
 *
 *   Packed weight: the mount's published 315 g, plus about 180 g of 3-ply
 *   carton, 50 g of wrap and filler and 30 g of screws and wall plugs.
 *
 * At these sizes the volumetric weight (32 x 16 x 26 / 5000 = 2.66 kg) is far
 * above the actual 0.58 kg, so the courier charges for 2.66 kg. The box, not
 * the mount, is what costs money: a carton cut closer to the mount is the
 * single biggest saving on shipping.
 *
 * A variant's own `weightGrams` (editable in the console) wins over
 * `defaultPackedWeightGrams` when it is set.
 */
export const shippingConfig = {
  /** Outer carton for one mount, cm. More than one unit stacks on the height. */
  box: { lengthCm: 32, breadthCm: 16, heightCm: 26 },
  /** Packed weight of one mount, grams: product + carton + filler + fixings. */
  defaultPackedWeightGrams: 575,
  /**
   * Stand-in pickup pincode for rate quotes, used only until
   * SHIPROCKET_PICKUP_LOCATION is set. After that, the pickup address's own
   * pincode is read from Shiprocket, since that is where the courier collects.
   */
  pickupPincode: siteConfig.address.pin,
} as const
