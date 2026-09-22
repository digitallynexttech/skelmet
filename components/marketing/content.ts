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
      "Not reliably, and we would rather say so. A helmet is heavy enough that adhesive strips creep over time. The bracket takes four screws and the anchors are in the box.",
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
    title: "Tape the template",
    body: "Stick the paper guide at helmet height: eye level works for most walls.",
  },
  { n: "02", title: "Drill four holes", body: "Anchors are in the box for masonry and drywall." },
  {
    n: "03",
    title: "Screw the bracket",
    body: "Snug, not gorilla-tight. Check it sits level before the last quarter turn.",
  },
  {
    n: "04",
    title: "Drop the skull on",
    body: "Slides onto the arm and locks. Helmet over the top, gloves on the hook.",
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
