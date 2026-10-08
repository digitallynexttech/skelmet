/** Homepage copy in one place, so the page component stays composition only. */

import { siteConfig } from "@/lib/config/site"
import { DEFAULT_PAYMENT_OPTIONS, paymentCopy } from "@/features/checkout/payment-options"

const P = siteConfig.promise

export const TICKER_ITEMS = [
  "MADE IN INDIA",
  "SHIPS PAN-INDIA",
  "HOLDS HELMET + GLOVES",
  "3 COLOURWAYS",
  "7-DAY RETURNS",
  "SHIPS IN 48 HOURS",
]

const PAY_QUESTION = "How do I pay for a SKELMET order?"

/**
 * Each question names its subject so it reads alone (search results, the accordion).
 * Figures come from siteConfig.promise, as the policies' do, so the FAQ cannot promise more.
 */
export const FAQ_ITEMS = [
  {
    question: "Will the SKELMET mount hold a full-face helmet?",
    answer:
      "Yes. Full-face, open-face and modular helmets all sit on it. The skull goes inside the helmet and spreads its weight across the liner, so no single spot of the padding is pressed out of shape.",
  },
  {
    question: "Which colours does the SKELMET skull come in?",
    answer:
      "Three: Blaze Orange, Militia Olive and Ghost Grey. Each is printed in matte PLA+ and comes on the same black arm.",
  },
  {
    question: "Can the SKELMET mount hold my jacket and gloves as well as my helmet?",
    answer:
      "Yes. The arm has hooks under the skull, and the whole mount is rated for 10 kg, so your helmet, gloves, jacket and keys can hang on it together.",
  },
  {
    question: "Will the SKELMET mount scratch my helmet's paint or visor?",
    answer:
      "No. Everything the helmet touches is smooth and rounded, so it rests on the mount without scratches or pressure marks.",
  },
  {
    question: "What comes in the SKELMET box?",
    answer:
      "The skull, already fixed to its black arm in one piece, a paper drilling guide that marks the three holes, three screws with wall plugs, a thank-you card and a mystery box.",
  },
  {
    question: "Can I put up the SKELMET mount without drilling?",
    answer:
      "We do not recommend it. The 10 kg rating holds when the mount is screwed into the wall with the three screws and wall plugs in the box. Adhesive strips and hooks are not made for that load, and the mount could come down. The paper guide in the box marks exactly where to drill.",
  },
  {
    question: "Will the SKELMET skull fade in sunlight?",
    answer:
      "Over months of direct sun, yes: PLA+ fades, so the mount is made for indoor walls. Out of direct sunlight the colour holds.",
  },
  {
    question: "How long does a SKELMET order take to arrive?",
    answer: `We dispatch every order within ${P.dispatchHours} hours of payment, and delivery takes up to ${P.deliveryDays} from dispatch. Your tracking link comes by email as soon as the parcel leaves us.`,
  },
  {
    // The rule, not the figures: those are set in the console and change without a deploy.
    question: "How much is shipping on a SKELMET order?",
    answer:
      "It depends on your pincode. Where the courier charges us up to a set amount to reach it, shipping is free. Where it costs more, you pay a share of the difference and we pay the rest. The shipping policy has the current figures, and checkout shows the exact charge as soon as you enter your pincode, before you pay.",
  },
  {
    // Online payment only; faqItems() swaps in the answer for the options in force.
    question: PAY_QUESTION,
    answer: paymentCopy(DEFAULT_PAYMENT_OPTIONS).faq,
  },
  {
    question: "Can I return the SKELMET mount?",
    answer: `Yes, within ${P.returnDays} days of delivery and for any reason, as long as it is unused, undrilled, undamaged and back in its original box. We book and pay for the pickup. Refunds are issued within ${P.refundDays} of approval, and banks usually take ${P.bankDays} more to show it.`,
  },
  {
    question: "What if my SKELMET mount arrives damaged?",
    answer: `Photograph it before you unpack any further and send us the photos within ${P.damageReportHours} hours of delivery. We send a replacement, and we do not ask for the damaged one back.`,
  },
  {
    question: "Is the SKELMET mount covered by a warranty?",
    answer: `Yes, for ${P.warrantyMonths} months from delivery, against cracking, deformation or the arm failing in normal indoor use. Send us a photo and we replace it. The warranty is on top of your rights under the Consumer Protection Act 2019.`,
  },
  {
    question: "Does SKELMET take bulk orders for riding clubs?",
    answer:
      "Yes, and from five units we can print them in a custom filament colour. Message us with how many you need and the colour you want.",
  },
]

/** The FAQ, with the question on paying answered for the ways to pay in force. */
export function faqItems(howToPay: string) {
  return FAQ_ITEMS.map((item) =>
    item.question === PAY_QUESTION ? { ...item, answer: howToPay } : item,
  )
}

export const REVIEWS = [
  {
    title: "Heavier than I expected, in a good way",
    body: "Was ready for cheap flimsy plastic. It's solid, the flames are properly sharp, and it hasn't budged in four months of daily use.",
    author: "ROHAN M. · PUNE · BLAZE ORANGE",
    rating: 5,
  },
  {
    title: "Bought one, ended up buying three",
    body: "Got it as a joke gift for my brother. He's now made me order two more for his riding group. Rip my wallet.",
    author: "AISHA K. · BENGALURU · GHOST GREY",
    rating: 5,
  },
  {
    title: "Install took 15 minutes, not 10",
    body: "That's on my brick wall, not the product. Olive against exposed brick looks unreal. Would buy again.",
    author: "DEV S. · DELHI · MILITIA OLIVE",
    rating: 4,
  },
  {
    title: "Liner actually dries out now",
    body: "Didn't buy it for this, but the helmet not sitting in a corner all night has genuinely fixed the smell problem.",
    author: "NEHA T. · MUMBAI · BLAZE ORANGE",
    rating: 5,
  },
]

export const RATING_BREAKDOWN = [
  { stars: 5, percent: 89 },
  { stars: 4, percent: 8 },
  { stars: 3, percent: 2 },
  { stars: 2, percent: 1 },
  { stars: 1, percent: 0 },
]

export const INSTALL_STEPS = [
  {
    n: "01",
    title: "Mark the holes",
    body: "Hold the mount's wall plate against the wall at the height you want and mark through its 3 holes with a pencil.",
  },
  {
    n: "02",
    title: "Drill",
    body: "Drill the holes at the marked points using an appropriate drill bit (typically 6 mm for standard wall plugs).",
  },
  {
    n: "03",
    title: "Plug",
    body: "Insert the wall plugs into the drilled holes until they are fully inside the wall.",
  },
  {
    n: "04",
    title: "Screw it on",
    body: "Line the wall plate up over the plugs and fix it with the 3 screws supplied. Make sure it is tight and secure.",
  },
]

export const COMPARISON_ROWS = [
  {
    label: "Scratches the shell",
    floor: "Constantly",
    hook: "Yes, bare metal",
    us: "No, it sits inside, on the liner",
  },
  { label: "Airs out the liner", floor: "Never", hook: "Partly", us: "Fully, open all night" },
  { label: "Holds your gloves", floor: "No", hook: "No", us: "Hooks on the mount" },
]

/** The comparison's last row: what SKELMET looks like is the skull the page sells. */
export const COMPARISON_LOOKS = { label: "Looks like", floor: "A mess", hook: "A coat hook" }

/** Client's copy, kept verbatim. Only the WHY_CARE kickers are ours. */
export const WHY_CARE = [
  {
    kicker: "The scratches",
    body: "You buy a top-of-the-line helmet, but it gets scratched because it's placed on a shoe rack or left on the floor.",
  },
  {
    kicker: "The damp liner",
    body: "The padding soaks up sweat, but it never gets the breathing room to actually dry.",
  },
  {
    kicker: "The shell itself",
    body: "Stored carelessly, the shell can warp, crack, or weaken; damage you won't notice until it matters most.",
  },
]

export const MORE_THAN_MOUNT = [
  {
    title: "Your riding gear in one place",
    body: "Mount your helmet on the skull and store your keys, riding jacket, and riding gloves on the hooks on the mount arm.",
  },
  {
    title: "More than storage",
    body: "The first thing people notice when they walk into the room; wherever you hang it, it owns the space.",
  },
  {
    title: "Built to protect, not just display",
    body: "No scratches from the shoe rack, no padding staying damp overnight. It looks good and works well.",
  },
]
