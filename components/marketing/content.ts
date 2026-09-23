/** Homepage copy in one place, so the page component stays composition only. */

export const TICKER_ITEMS = [
  "MADE IN INDIA",
  "FREE SHIPPING PAN-INDIA",
  "HOLDS HELMET + GLOVES",
  "3 COLOURWAYS",
  "7-DAY RETURNS",
  "SHIPS IN 48 HRS",
]

export const FAQ_ITEMS = [
  {
    question: "Will it hold a full-face helmet?",
    answer:
      "Yes. Full-face, open-face and modular all sit on it. The skull goes inside the shell so the weight is carried by the cradle, not the padding.",
  },
  {
    question: "Can I mount it without drilling?",
    answer:
      "Not recommended; screws provide a solid hold against the wall, which makes the mount able to hold 10 kg. Any other way can compromise the mount and its holding capacity.",
  },
  {
    question: "Can the Skelmet hold jackets or gloves along with the helmet?",
    answer:
      "Yes, the mount has hooks on the arm and is made to hold up to 10 kg of weight. You can mount your helmet and store your keys, gloves, and jackets all at once.",
  },
  {
    question: "Does the Skelmet scratch or damage the helmet's paint or visor?",
    answer:
      "No. The contact points are smooth and rounded, so the helmet rests on the mount without any scratching or pressure marks.",
  },
  {
    question: "Does the colour fade in sunlight?",
    answer:
      "PLA+ will fade under months of direct sun, so this is an indoor mount. On a normal interior wall the colour holds.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "We dispatch within 48 hours on working days, and most pincodes see it in three to six working days. Tracking lands by email and WhatsApp.",
  },
  {
    question: "Do you do bulk orders for clubs?",
    answer:
      "Yes, and custom filament colour is available from five units. Message us with the count and the colour you want.",
  },
  {
    question: "What if it arrives damaged?",
    answer:
      "Photograph it before you unpack any further and send it to us within 48 hours. We replace it, and we do not ask for the damaged one back.",
  },
]

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
    title: "Hold it up and mark",
    body: "Hold the mount against the wall where you want it and mark through the holes in the arm.",
  },
  {
    n: "02",
    title: "Drill and plug",
    body: "Drill the holes, clear out any dust or debris in them, and push in the wall plugs from the box.",
  },
  {
    n: "03",
    title: "Screw it on",
    body: "Line up the mount with the holes, screw it in with the screws from the box, and you're done.",
  },
]

export const COMPARISON_ROWS = [
  {
    label: "Scratches the shell",
    floor: "Constantly",
    hook: "Yes, bare metal",
    us: "No, soft cradle inside",
  },
  { label: "Airs out the liner", floor: "Never", hook: "Partly", us: "Fully, open all night" },
  { label: "Holds your gloves", floor: "No", hook: "No", us: "Hook under the jaw" },
  { label: "Looks like", floor: "A mess", hook: "A coat hook", us: "A flaming skull" },
]

/**
 * The case for owning one, in two halves: what goes wrong without it, then
 * what it does beyond holding a helmet. Copy supplied by the client and kept
 * verbatim — the only additions are the short kickers on WHY_CARE, which are
 * drawn from the sentence each one sits above so the list can be scanned.
 */
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
