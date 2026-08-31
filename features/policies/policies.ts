/**
 * Policy content registry (client-safe, §4).
 *
 * NOT LEGAL ADVICE. The structure follows what an Indian D2C store needs, 
 * the DPDP Act 2023 and the Consumer Protection (E-Commerce) Rules 2020,
 * including the grievance-officer block both require. Every [BRACKETED] value
 * and the final wording must be settled by a lawyer before launch, which is
 * why each page renders a visible banner saying so.
 */

export type PolicyBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "contact" }

export type PolicySection = {
  n: string
  title: string
  blocks: PolicyBlock[]
}

export type Policy = {
  slug: string
  title: string
  intro: string
  readingTime: string
  shortVersion: string
  accent: "blaze" | "violet" | "acid" | "magenta"
  sections: PolicySection[]
}

const PRIVACY: Policy = {
  slug: "privacy",
  title: "Privacy policy",
  intro:
    "What we collect, why we collect it, and how to make us delete it. Written to be read, not to be survived.",
  readingTime: "~8 min read",
  shortVersion:
    "We collect what we need to ship you a skull and nothing else. We don't sell your data. Email us and we'll delete it.",
  accent: "violet",
  sections: [
    {
      n: "01",
      title: "Who we are",
      blocks: [
        {
          type: "p",
          text: "SKELMET is operated by Gee Star Spinning Solutions, registered at B-121, B Block, Udyog Marg, Sector 6, Noida, Gautam Buddha Nagar, Uttar Pradesh 201301, GSTIN 09AOIPJ0692M1ZG. In this policy “we”, “us” and “our” mean that company; “you” means anyone who visits skelmet.in or buys from us.",
        },
        {
          type: "p",
          text: "We are the data fiduciary for the personal data described below, in the sense the Digital Personal Data Protection Act 2023 uses that term.",
        },
      ],
    },
    {
      n: "02",
      title: "What we collect",
      blocks: [
        {
          type: "list",
          items: [
            "Identity and contact: name, email address, phone number.",
            "Delivery: shipping address, pincode, any delivery note you add.",
            "Order: what you bought, colourway, quantity, price paid, discount or referral code used.",
            "Payment: the gateway's transaction reference and status. We never see or store your full card number, CVV or UPI PIN.",
            "Account: a hashed password, saved addresses, your referral code and balance, if you create an account.",
            "Technical: IP address, browser and device type, pages viewed, referring site.",
            "Content you send us: support messages, review text, and any photo you submit to the rider wall.",
          ],
        },
      ],
    },
    {
      n: "03",
      title: "How we collect it",
      blocks: [
        {
          type: "p",
          text: "Most of it you give us directly: at checkout, when you create an account, when you write to us or post a review. Technical data is collected automatically by our servers and by the cookies described in section 06. We do not buy personal data from third parties or scrape it.",
        },
      ],
    },
    {
      n: "04",
      title: "Why we use it",
      blocks: [
        {
          type: "list",
          items: [
            "To take payment, pack your order and get it delivered.",
            "To email or message you about that order: confirmation, dispatch, tracking, delivery.",
            "To handle returns, replacements and refunds.",
            "To answer your support messages.",
            "To run the referral programme and pay out what you have earned.",
            "To detect fraud and abuse of discount codes.",
            "To meet tax, accounting and consumer-law obligations.",
            "With your consent only, to send marketing about new drops.",
          ],
        },
      ],
    },
    {
      n: "05",
      title: "Payment information",
      blocks: [
        {
          type: "p",
          text: "Payments are processed by Razorpay. Your card, netbanking or UPI credentials go directly to them over an encrypted connection and never touch our servers. We receive only a transaction id, the amount, the method and whether it succeeded, enough to reconcile your order and issue a refund.",
        },
      ],
    },
    {
      n: "06",
      title: "Cookies & tracking",
      blocks: [
        { type: "p", text: "We use three kinds, and you can refuse all but the first:" },
        {
          type: "list",
          items: [
            "Strictly necessary: keeping you signed in and remembering your cart. The site does not work without these.",
            "Analytics: anonymous, aggregated page and conversion statistics.",
            "Marketing: used to measure ad performance and show you a reminder if you abandon a cart.",
          ],
        },
        {
          type: "p",
          text: "You can change your choice at any time from the cookie settings link in the footer, or block cookies in your browser.",
        },
      ],
    },
    {
      n: "07",
      title: "Who we share with",
      blocks: [
        {
          type: "p",
          text: "We do not sell your personal data. We share the minimum necessary with the processors in section 08, and we disclose data where the law requires it, a court order, a tax authority, or a genuine law-enforcement request we are satisfied is valid.",
        },
        {
          type: "p",
          text: "If the business is ever sold or merged, your data may transfer to the buyer under the same commitments; we will tell you before that happens.",
        },
      ],
    },
    {
      n: "08",
      title: "Processors we use",
      blocks: [
        {
          type: "table",
          head: ["Processor", "Purpose", "Data seen"],
          rows: [
            ["Razorpay", "Taking payment", "Name, email, amount"],
            ["[COURIER]", "Delivering the parcel", "Name, address, phone"],
            ["[EMAIL PROVIDER]", "Order and support email", "Name, email"],
            ["[HOSTING]", "Running the site", "Technical data"],
            ["[ANALYTICS]", "Aggregate statistics", "Anonymised usage"],
          ],
        },
      ],
    },
    {
      n: "09",
      title: "How long we keep it",
      blocks: [
        {
          type: "list",
          items: [
            "Order and invoice records: [8] years, because tax law says so.",
            "Account data: until you delete the account, then [30] days in backups.",
            "Support messages: [24] months.",
            "Abandoned carts: [90] days.",
            "Marketing consent records: for as long as you are subscribed, plus [24] months as proof of consent.",
          ],
        },
      ],
    },
    {
      n: "10",
      title: "Your rights",
      blocks: [
        { type: "p", text: "Under the DPDP Act 2023 you can ask us to:" },
        {
          type: "list",
          items: [
            "Tell you what data we hold about you and who we have shared it with.",
            "Correct anything that is wrong or out of date.",
            "Erase data we no longer need for a legal purpose.",
            "Withdraw a consent you previously gave.",
            "Nominate someone to exercise these rights if you die or become incapacitated.",
          ],
        },
        {
          type: "p",
          text: "Write to the grievance officer in the last section. We will respond within [30] days. If you are not satisfied you may complain to the Data Protection Board of India.",
        },
      ],
    },
    {
      n: "11",
      title: "Marketing & opt-out",
      blocks: [
        {
          type: "p",
          text: "We only email you about new drops if you asked us to. Every one of those emails has a one-click unsubscribe, and unsubscribing does not affect the transactional emails about an order you have placed. We do not send marketing over WhatsApp unless you have separately opted in.",
        },
      ],
    },
    {
      n: "12",
      title: "Referral programme data",
      blocks: [
        {
          type: "p",
          text: "If you refer someone, we record their email in a masked form (for example a****k@gmail.com) so you can see the status of your invite without us exposing their full address to you. The person you referred is told which code they used but not who owns it, unless you tell them yourself.",
        },
      ],
    },
    {
      n: "13",
      title: "Children",
      blocks: [
        {
          type: "p",
          text: "SKELMET is not sold to anyone under 18. We do not knowingly collect data from children, and we do not do behavioural advertising or tracking directed at them. If you believe a child has given us data, write to the grievance officer and we will delete it.",
        },
      ],
    },
    {
      n: "14",
      title: "Security",
      blocks: [
        {
          type: "p",
          text: "The site runs over TLS. Passwords are stored hashed, never in plain text. Access to customer data inside the company is limited to the people who need it and is logged. Payment credentials never reach us at all.",
        },
        {
          type: "p",
          text: "No system is perfect. If a breach affects your data we will notify you and the Data Protection Board as the DPDP Act requires.",
        },
      ],
    },
    {
      n: "15",
      title: "Transfers outside India",
      blocks: [
        {
          type: "p",
          text: "Some processors store data outside India. Where they do, we rely on contractual protections with that provider and only use providers in countries not restricted by the Central Government. The current list of hosting regions is [REGIONS].",
        },
      ],
    },
    {
      n: "16",
      title: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "If we change anything that materially affects you, we will update the date at the top and email anyone with an account at least [14] days before the change takes effect. Older versions are kept and can be requested.",
        },
      ],
    },
    {
      n: "17",
      title: "Grievance officer",
      blocks: [
        {
          type: "p",
          text: "As required by the DPDP Act 2023 and the Consumer Protection (E-Commerce) Rules 2020:",
        },
        { type: "contact" },
      ],
    },
  ],
}

const TERMS: Policy = {
  slug: "terms",
  title: "Terms of service",
  intro: "The deal between you and us when you buy a skull. Short sentences, no traps.",
  readingTime: "~9 min read",
  shortVersion:
    "Buy it, we ship it. Don't like it, send it back within 7 days. Don't hang a person off it.",
  accent: "blaze",
  sections: [
    {
      n: "01",
      title: "Agreeing to these terms",
      blocks: [
        {
          type: "p",
          text: "By using skelmet.in or placing an order you accept these terms. They form a contract between you and Gee Star Spinning Solutions, registered at B-121, B Block, Udyog Marg, Sector 6, Noida, Gautam Buddha Nagar, Uttar Pradesh 201301. If you do not accept them, do not order.",
        },
        {
          type: "p",
          text: "We may change these terms. The version that applies to your order is the one published when you placed it, and we keep every past version on file.",
        },
      ],
    },
    {
      n: "02",
      title: "Who can buy",
      blocks: [
        {
          type: "p",
          text: "You must be 18 or older and able to enter a contract under the Indian Contract Act 1872. We currently ship only within India. Orders that look like resale or bulk arbitrage may be declined, for genuine bulk and club orders, talk to us first.",
        },
      ],
    },
    {
      n: "03",
      title: "Your account",
      blocks: [
        {
          type: "p",
          text: "You can check out as a guest. If you create an account, keep the password to yourself, anything done through your account is treated as done by you. Tell us immediately if you think someone else has access. We can suspend an account being used for fraud or abuse.",
        },
      ],
    },
    {
      n: "04",
      title: "Products & descriptions",
      blocks: [
        {
          type: "p",
          text: "Every mount is 3D printed to order. That means small variations in layer texture and finish between units are normal and are not defects, it is the point of the product.",
        },
        {
          type: "p",
          text: "Colours on your screen will not match the physical filament exactly. Dimensions and load figures published on the product page are [TO BE CONFIRMED BEFORE LAUNCH] and are given as guidance.",
        },
      ],
    },
    {
      n: "05",
      title: "Prices & taxes",
      blocks: [
        {
          type: "p",
          text: "Prices are in Indian Rupees and include GST. The price you see at checkout is the price you pay, no surprise fees at delivery, except the COD handling charge which is shown before you confirm.",
        },
        {
          type: "p",
          text: "If a price is listed wrongly because of an obvious error, we may cancel the order and refund you in full rather than honour it. We will tell you before doing that.",
        },
      ],
    },
    {
      n: "06",
      title: "Placing an order",
      blocks: [
        {
          type: "p",
          text: "Your order is an offer to buy. The contract forms when we send the dispatch confirmation, not the order confirmation. Until then we may decline the order, because stock ran out mid-batch, the address is not serviceable, or payment failed verification.",
        },
      ],
    },
    {
      n: "07",
      title: "Payment",
      blocks: [
        {
          type: "p",
          text: "We accept UPI, cards, netbanking and cash on delivery. Payments are handled by Razorpay; we never see your card or UPI credentials. For COD, the parcel is only handed over on full payment.",
        },
      ],
    },
    {
      n: "08",
      title: "Shipping & delivery",
      blocks: [
        {
          type: "list",
          items: [
            "We dispatch within [48] hours of payment clearing, on working days.",
            "Typical delivery is [3–6] working days depending on pincode.",
            "Shipping is free across India on all orders.",
            "Risk passes to you on delivery. If the parcel arrives visibly damaged, refuse it or photograph it before opening and tell us within [48] hours.",
            "Three failed delivery attempts return the parcel to us; we will refund minus the actual return freight.",
          ],
        },
      ],
    },
    {
      n: "09",
      title: "Returns & refunds",
      blocks: [
        {
          type: "p",
          text: "You have 7 days from delivery to return a mount for any reason. It must be unused, undamaged and in its original packaging. We arrange and pay for the reverse pickup.",
        },
        {
          type: "p",
          text: "Refunds are issued to the original payment method within [7] working days of the return reaching us and passing inspection. For COD orders we refund by UPI or bank transfer to details you provide.",
        },
        {
          type: "p",
          text: "Custom-colour and engraved orders are made specifically for you and cannot be returned unless faulty.",
        },
      ],
    },
    {
      n: "10",
      title: "Cancellations",
      blocks: [
        {
          type: "p",
          text: "Cancel free of charge any time before dispatch, from your account or by messaging us. Once the parcel has left us, use the returns process instead.",
        },
      ],
    },
    {
      n: "11",
      title: "Warranty",
      blocks: [
        {
          type: "p",
          text: "We warrant the mount against cracking, deformation or bracket failure in normal indoor domestic use for [12] months from delivery. If that happens, send us a photo and we will replace it.",
        },
        {
          type: "p",
          text: "Not covered: colour fade from direct sunlight, damage from loads beyond the published rating, outdoor use, drops, modification, or fixings other than those supplied.",
        },
        {
          type: "p",
          text: "This warranty is in addition to your rights under the Consumer Protection Act 2019, which it does not limit.",
        },
      ],
    },
    {
      n: "12",
      title: "Safe use",
      blocks: [
        {
          type: "p",
          text: "This is a decorative indoor wall mount for a helmet and light riding gear. It is not climbing equipment, not a handhold, not a step, and not rated to carry a person. Fix it only into a sound wall using the supplied anchors and follow the instructions. We are not liable for damage caused by incorrect installation or by using it for something it was never sold to do.",
        },
      ],
    },
    {
      n: "13",
      title: "Discount codes",
      blocks: [
        {
          type: "p",
          text: "One code per order unless we say otherwise. Codes have no cash value, cannot be applied after an order is placed, and can be withdrawn if we find them being scraped, resold or posted to coupon-aggregator sites.",
        },
      ],
    },
    {
      n: "14",
      title: "Referral programme",
      blocks: [
        {
          type: "list",
          items: [
            "The person you refer must be a new customer using your code on their first order.",
            "Your reward credits once their order has shipped and cleared the 7-day return window.",
            "Rewards can be cashed out to UPI from [₹500], or spent on the site at any balance.",
            "Self-referrals, duplicate accounts and fake orders void the reward and may close the account.",
            "We may change the reward amount for future referrals, but never for one already earned.",
          ],
        },
      ],
    },
    {
      n: "15",
      title: "Reviews & photos you post",
      blocks: [
        {
          type: "p",
          text: "When you submit a review or a rider-wall photo, you keep ownership of it and give us a non-exclusive, royalty-free licence to show it on the site and our social accounts, with your first name and city.",
        },
        {
          type: "p",
          text: "Don't post anything you don't own, anything defamatory, or anything containing another person who has not agreed. We may remove content that breaks this, and we do not edit reviews to make them more favourable.",
        },
      ],
    },
    {
      n: "16",
      title: "Our intellectual property",
      blocks: [
        {
          type: "p",
          text: "The SKELMET name, the skull design, the 3D model files, the photography and the site itself are ours. Buying a mount buys you the object, not the design. You may not copy, 3D-scan, reproduce or sell the design, and you may not list our photography on a marketplace as your own.",
        },
        { type: "p", text: "Photographing your own mount and posting it is entirely fine, and encouraged." },
      ],
    },
    {
      n: "17",
      title: "Liability",
      blocks: [
        {
          type: "p",
          text: "Our total liability for any order is limited to what you paid for it, except where the law does not allow that limit, in particular for death or personal injury caused by our negligence, or for fraud.",
        },
        {
          type: "p",
          text: "We are not liable for indirect or consequential losses, such as damage to a helmet caused by installing the mount incorrectly.",
        },
      ],
    },
    {
      n: "18",
      title: "Governing law",
      blocks: [
        {
          type: "p",
          text: "These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Gautam Buddha Nagar, Uttar Pradesh. Before going to court, please raise it with the grievance officer, most things get sorted there.",
        },
      ],
    },
    {
      n: "19",
      title: "Grievance officer",
      blocks: [
        { type: "p", text: "Appointed under the Consumer Protection (E-Commerce) Rules 2020:" },
        { type: "contact" },
      ],
    },
  ],
}

const SHIPPING: Policy = {
  slug: "shipping",
  title: "Shipping policy",
  intro: "When it leaves, how it travels, and what happens if it goes wrong.",
  readingTime: "~4 min read",
  shortVersion: "Free everywhere in India. Out in 48 hours, usually with you in 3–6 working days.",
  accent: "acid",
  sections: [
    {
      n: "01",
      title: "Where we ship",
      blocks: [
        {
          type: "p",
          text: "Everywhere in India that [COURIER] serves. Enter your pincode on the product page and we will tell you before you pay. We do not ship internationally yet, if you want one abroad, message us and we will quote a courier directly.",
        },
      ],
    },
    {
      n: "02",
      title: "What it costs",
      blocks: [
        {
          type: "p",
          text: "Nothing. Shipping is free on every order, to every serviceable pincode, with no minimum. Cash on delivery adds a [₹49] handling charge, shown before you confirm.",
        },
      ],
    },
    {
      n: "03",
      title: "Dispatch time",
      blocks: [
        {
          type: "p",
          text: "Orders placed before [4pm IST] on a working day are printed, finished and packed within [48] hours. Orders placed on a Sunday or a public holiday start counting from the next working day.",
        },
        {
          type: "p",
          text: "During a batch changeover this can stretch to [4] working days. If it does, we email you rather than let you wonder.",
        },
      ],
    },
    {
      n: "04",
      title: "Delivery time",
      blocks: [
        {
          type: "table",
          head: ["Zone", "Typical time"],
          rows: [
            ["Metro cities", "[2–3] working days"],
            ["Tier 2 and 3 cities", "[3–5] working days"],
            ["Rest of India", "[5–7] working days"],
            ["Remote and North-East", "[7–10] working days"],
          ],
        },
      ],
    },
    {
      n: "05",
      title: "Tracking",
      blocks: [
        {
          type: "p",
          text: "The moment the parcel is handed to the courier you get an email and a WhatsApp message with the AWB number and a live tracking link. You can also track it from /track with your order number and email, without signing in.",
        },
      ],
    },
    {
      n: "06",
      title: "Failed deliveries",
      blocks: [
        {
          type: "p",
          text: "The courier attempts delivery three times. If nobody is available the parcel comes back to us and we refund you minus the actual return freight. If you know you will be away, reply to the dispatch email and we will hold it.",
        },
      ],
    },
    {
      n: "07",
      title: "Damaged in transit",
      blocks: [
        {
          type: "p",
          text: "Photograph the parcel before you open it further and send it to us within [48] hours of delivery. We ship a replacement immediately and we do not ask for the damaged one back.",
        },
      ],
    },
    {
      n: "08",
      title: "Questions",
      blocks: [{ type: "contact" }],
    },
  ],
}

const RETURNS: Policy = {
  slug: "returns",
  title: "Returns & refunds",
  intro: "Seven days, no interrogation, and we pay the pickup.",
  readingTime: "~4 min read",
  shortVersion: "Changed your mind? Seven days, unused, original box. We collect it and refund you.",
  accent: "magenta",
  sections: [
    {
      n: "01",
      title: "The window",
      blocks: [
        {
          type: "p",
          text: "You have 7 days from delivery to start a return, for any reason at all, including simply not liking it on the wall.",
        },
      ],
    },
    {
      n: "02",
      title: "Condition",
      blocks: [
        {
          type: "list",
          items: [
            "Unused and undamaged, with no drill marks or adhesive residue.",
            "In the original box with the bracket, screws and template.",
            "Test-fitting it against the wall is fine. Drilling and mounting it is not.",
          ],
        },
      ],
    },
    {
      n: "03",
      title: "How to start one",
      blocks: [
        {
          type: "list",
          items: [
            "Message us with your order number and a one-line reason.",
            "We book a reverse pickup within [24] hours, at our cost.",
            "Repack it in the original box and hand it to the courier.",
            "We inspect it the day it arrives and refund the same day it passes.",
          ],
        },
      ],
    },
    {
      n: "04",
      title: "Refund timing",
      blocks: [
        {
          type: "table",
          head: ["Paid with", "Refund lands in"],
          rows: [
            ["UPI", "[1–3] working days"],
            ["Card", "[5–7] working days"],
            ["Netbanking", "[3–5] working days"],
            ["Cash on delivery", "[2–4] working days to your UPI or bank"],
          ],
        },
      ],
    },
    {
      n: "05",
      title: "Faulty or wrong item",
      blocks: [
        {
          type: "p",
          text: "If it arrives cracked, warped, in the wrong colourway, or missing parts, send us a photo. We ship a replacement straight away and you keep or bin the original, whichever is less hassle. This is separate from the 7-day window and is not time-limited beyond the [12]-month warranty.",
        },
      ],
    },
    {
      n: "06",
      title: "What we can't take back",
      blocks: [
        {
          type: "list",
          items: [
            "Custom-colour or engraved orders, unless faulty.",
            "Mounts that have been drilled in and used.",
            "Anything returned after the 7-day window without a fault.",
          ],
        },
      ],
    },
    {
      n: "07",
      title: "Exchanges",
      blocks: [
        {
          type: "p",
          text: "Want a different colourway rather than your money back? Say so when you start the return and we ship the replacement as soon as the original is collected, you are not waiting on the refund first.",
        },
      ],
    },
    {
      n: "08",
      title: "Questions",
      blocks: [{ type: "contact" }],
    },
  ],
}

const REFERRAL: Policy = {
  slug: "referral",
  title: "Referral terms",
  intro: "How the ₹250 works, when it lands, and what voids it.",
  readingTime: "~3 min read",
  shortVersion: "They save ₹250, you earn ₹250 once their order ships and clears returns.",
  accent: "acid",
  sections: [
    {
      n: "01",
      title: "Who can take part",
      blocks: [
        {
          type: "p",
          text: "Anyone with a SKELMET account. Every order generates a code automatically, and you can also sign up for one without buying first.",
        },
      ],
    },
    {
      n: "02",
      title: "What each side gets",
      blocks: [
        {
          type: "list",
            items: [
            "The person you refer gets ₹250 off their first order.",
            "You get ₹250 credited to your SKELMET balance.",
            "Tiers raise your side: ₹350 from 5 referrals, ₹500 from 15.",
          ],
        },
      ],
    },
    {
      n: "03",
      title: "When it credits",
      blocks: [
        {
          type: "p",
          text: "Once their order has shipped and cleared the 7-day return window. If they return the order, the reward does not credit, which is why it waits rather than paying out on checkout.",
        },
      ],
    },
    {
      n: "04",
      title: "Cashing out",
      blocks: [
        {
          type: "p",
          text: "Spend the balance on the site at any amount, or cash out to UPI from [₹500]. Payouts are processed within [5] working days of the request.",
        },
      ],
    },
    {
      n: "05",
      title: "What voids a reward",
      blocks: [
        {
          type: "list",
          items: [
            "Referring yourself, or a duplicate account at your own address.",
            "Orders placed and then returned.",
            "Posting your code to coupon-aggregator or deal sites.",
            "Paid advertising that bids on the SKELMET brand name.",
          ],
        },
      ],
    },
    {
      n: "06",
      title: "Changes",
      blocks: [
        {
          type: "p",
          text: "We may change the reward amount or the tiers for future referrals. Anything you have already earned is yours at the rate it was earned at.",
        },
      ],
    },
    { n: "07", title: "Questions", blocks: [{ type: "contact" }] },
  ],
}

export const POLICIES: Policy[] = [PRIVACY, TERMS, SHIPPING, RETURNS, REFERRAL]

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug)
}
