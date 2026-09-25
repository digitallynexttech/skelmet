import { siteConfig } from "@/config/site"

/**
 * What a parcel looks like to the courier.
 *
 * Couriers bill on whichever is larger: the actual weight, or the volumetric
 * weight of the box (L x B x H in cm / 5000 for most Indian couriers). So these
 * numbers set the price of every shipment - a box a few centimetres too big
 * can cost more than the mount weighs.
 *
 * Packed weight: MEASURED. 920 g for one box with everything in it - mount,
 * carton, packing and fixings - as weighed by the shop.
 *
 * [TO CONFIRM] Box size: still an estimate. Measure the carton one mount ships
 * in and replace it. How it was estimated:
 *
 *   The mount ships as one piece, skull and arm together. Scaled from the
 *   side-on product shot (public/product/mount-assembled.jpg) against a skull
 *   of about 16 cm, it is roughly 30 cm long, 24 cm tall and 14 cm across the
 *   skull. The carton allows about a centimetre of padding each way.
 *
 * At this size the volumetric weight (32 x 16 x 26 / 5000 = 2.66 kg) is well
 * above the actual 0.92 kg, so the courier charges for 2.66 kg. The box, not
 * the mount, is what costs money: a carton cut closer to the mount is the
 * single biggest saving on shipping. Below about 4,600 cm3 (4,600 / 5000 =
 * 0.92 kg) the real weight would take over and the box stop mattering.
 *
 * A variant's own `weightGrams` (editable in the console) wins over
 * `defaultPackedWeightGrams` when it is set.
 */
export const shippingConfig = {
  /** Outer carton for one mount, cm. More than one unit stacks on the height. */
  box: { lengthCm: 32, breadthCm: 16, heightCm: 26 },
  /** Packed weight of one mount, grams: product + carton + filler + fixings. Measured. */
  defaultPackedWeightGrams: 920,
  /**
   * Stand-in pickup pincode for rate quotes, used only until
   * SHIPROCKET_PICKUP_LOCATION is set. After that, the pickup address's own
   * pincode is read from Shiprocket, since that is where the courier collects.
   */
  pickupPincode: siteConfig.address.pin,
} as const
