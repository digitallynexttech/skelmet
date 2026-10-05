/**
 * Policy content registry (client-safe, §4).
 *
 * The structure follows what an Indian D2C store needs under the DPDP Act 2023
 * and the Consumer Protection (E-Commerce) Rules 2020, including the
 * grievance-officer block both require. The figures in it - dispatch,
 * delivery, the damage window, refund timing, grievance timings - are the
 * shop's own decisions and live in siteConfig.promise, so the policies, the
 * FAQ and the emails cannot quote different ones.
 */

import { shippingConfig } from "@/config/shipping"
import { siteConfig } from "@/config/site"
import { DEFAULT_PAYMENT_OPTIONS, paymentCopy } from "@/features/checkout/payment-options"
import type { PaymentOptions } from "@/features/settings/schemas/runtime-settings.schema"
import { formatMoney } from "@/lib/money"

const P = siteConfig.promise

/** Who "we" are, in the words every policy uses. */
const BUSINESS = `${siteConfig.legalEntity}, a ${siteConfig.legalForm} (GSTIN ${siteConfig.gstin}), which trades as ${siteConfig.name}`
const ADDRESS = `${siteConfig.address.line1}, ${siteConfig.address.city} ${siteConfig.address.pin}`

/** The one statement of refund timing, used wherever a refund is promised. */
const REFUND_TIMING = `Refunds are issued to the original payment method within ${P.refundDays} of approval. Banks usually take ${P.bankDays} more to show it.`

/**
 * The shipping charge, as the policy states it. Checkout charges by the rule in
 * the console's Settings, so the page is handed that same rule (getPolicy)
 * rather than stating config/shipping.ts's default.
 */
type ShippingRule = { aboveRupees: number; sharePercent: number }

function shippingTerms(rule: ShippingRule): { short: string; cost: string } {
  if (rule.sharePercent <= 0) {
    return {
      short: "Free to every pincode we deliver to.",
      cost: "Nothing. Shipping is free to every pincode we deliver to, whatever the courier charges us. Checkout confirms we deliver to yours as soon as you enter your pincode, before you pay.",
    }
  }
  const upTo = formatMoney(rule.aboveRupees)
  const share = rule.sharePercent === 50 ? "half" : `${rule.sharePercent}%`
  const example = rule.aboveRupees + 200
  const exampleFee = formatMoney(Math.round((200 * rule.sharePercent) / 100))
  return {
    short: `Free where delivery costs us ${upTo} or less; beyond that you pay ${share} of the difference.`,
    cost: `It depends on where it is going. If couriers charge us ${upTo} or less to reach your pincode, shipping is free. If they charge more, you pay ${share} of the amount above ${upTo} and we pay the rest - a courier costing ${formatMoney(example)} costs you ${exampleFee}. Checkout shows the exact charge as soon as you enter your pincode, before you pay.`,
  }
}

/** A run of plain text, or a link inside a paragraph. */
export type Inline = string | { text: string; href: string }

export type PolicyBlock =
  | { type: "p"; text: string | Inline[] }
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
  /** ISO date the wording last changed. Shown on the page and given to the sitemap. */
  updated: string
  version: string
  sections: PolicySection[]
}

const PRIVACY: Policy = {
  slug: "privacy",
  title: "Privacy policy",
  intro:
    "What we collect, why we collect it, who we share it with, how long we keep it, and how to make us delete it. Written to be read, not to be survived.",
  readingTime: "~8 min read",
  shortVersion:
    "We collect what we need to ship you a skull, count visits anonymously, and remember your device between visits only if you accept cookies. We don't sell your data. Email us and we'll delete it.",
  accent: "violet",
  updated: "2026-10-01",
  version: "1.3",
  sections: [
    {
      n: "01",
      title: "Who we are",
      blocks: [
        {
          type: "p",
          text: `SKELMET is run by ${BUSINESS}, from ${ADDRESS}. In this policy “we”, “us” and “our” mean that business; “you” means anyone who visits skelmet.in or buys from us.`,
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
            "Order: what you bought, colourway, quantity, price paid, any discount code used - including an order you place and do not pay for.",
            "Payment: the gateway's transaction reference and status. We never see or store your full card number, CVV or UPI PIN.",
            "Technical, for every visit: pages viewed and the time spent on each, browser and device type, the approximate area your connection comes from (city, district and state), the site or campaign that sent you, and what you put in your cart.",
            "Technical, only if you accept cookies: your IP address and the approximate point on a map it places your connection at, your device model, a cookie that recognises this device on later visits, and the email, phone, name and pincode you type at checkout, even if you do not place the order.",
            "Content you send us: support messages, review text, and any photo you tag us in and agree to let us show.",
            "If you ask to hear about new drops: your email address, and when you asked.",
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
          text: "Most of it you give us directly: at checkout, when you write to us or post a review. There are no customer accounts to sign up for. Technical data is collected automatically by our servers and by the visit counter and cookies described in section 06. We do not buy personal data from third parties or scrape it.",
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
            "To detect fraud and abuse of discount codes.",
            "To meet tax, accounting and consumer-law obligations.",
            "To see which pages and products interest people and where they stop, so we can improve the shop.",
            "If you accepted cookies, to remind you by email, phone or WhatsApp about a cart or a payment you did not finish.",
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
        {
          type: "p",
          text: "Every visit is counted. What we keep depends on whether you accept or decline cookies:",
        },
        {
          type: "list",
          items: [
            "Strictly necessary, always: your cart and your cookie choice, kept in your own browser, and a cookie that lets the confirmation page show the order you just placed. The site does not work without these.",
            "Anonymous visit counts, always: the pages you view and for how long, your device type and browser, the approximate area your connection comes from (city, district and state), the site or campaign that sent you, and what you put in your cart. There is no cookie and your IP address is not stored, so none of it is linked to you or to your other visits. Google Analytics also receives a cookieless signal for each page, which Google uses only in aggregate.",
            "Only if you accept: a cookie that recognises this device for a year, and with it your IP address and the approximate map point it gives (usually your network's area, not your street), your device model, the pages and cart of each visit, and the email, phone, name and pincode you type at checkout, even if you do not place the order. Each browser keeps its own cookie, so we show our staff visits as probably one person's when they share the email or phone you typed, or the same connection and kind of device within a few hours, and only among visitors who accepted. We use it to understand what people look for, and to remind you about a cart or a payment you did not finish. Accepting also turns on Google Analytics' cookies, which measure visits and let Google measure and show our ads, and Microsoft Clarity, which records how the pages are used - clicks, taps and scrolling - as one recording per visit. Clarity's recordings hide anything you type into a form and the pages showing your name, address or order. Accepting also turns on the Meta Pixel, which tells Meta (Facebook and Instagram) the pages you view, the products you view, add to your cart and buy, and what an order is worth, with Meta's cookies, so that we can measure our ads there and show them to people likely to want a mount. It does not receive what you type at checkout.",
          ],
        },
        {
          type: "p",
          text: "You can change your choice at any time from Cookie settings at the foot of every page. If you take your consent back, the cookie is removed, and your IP address, its map point and the contact details you typed are deleted from our visit records; what remains is anonymous.",
        },
      ],
    },
    {
      n: "07",
      title: "Who we share with",
      blocks: [
        {
          type: "p",
          text: "We do not sell your personal data. We share the minimum necessary with the processors in section 08, and we disclose data where the law requires it: a court order, a tax authority, or a genuine law-enforcement request we are satisfied is valid.",
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
            ["Razorpay", "Taking payment", "Name, email, phone, amount"],
            [
              "Shiprocket and its courier partners",
              "Delivering the parcel",
              "Name, address, phone, what is in the parcel",
            ],
            ["Google (Gmail)", "Order and support email", "Name, email, what the email says"],
            [
              "Our cloud server provider",
              "Running the site and its database",
              "Everything the site stores, held on its servers",
            ],
            [
              "Cloudflare",
              "Delivering the site, and the area a visit comes from",
              "Technical data, IP address",
            ],
            [
              "Microsoft (Clarity)",
              "How pages are used: clicks, scrolling, heatmaps and session recordings",
              "Only if you accept: pages viewed, device, approximate location, on-page actions (form entries hidden), and its cookies",
            ],
            [
              "Google (Analytics and Ads)",
              "Visit statistics and ad measurement",
              "Pages viewed, device, approximate location; cookies only if you accept",
            ],
            [
              "Meta (Pixel)",
              "Measuring and showing our ads on Facebook and Instagram",
              "Only if you accept: pages viewed, products viewed, added to cart and bought, order value, device, and its cookies",
            ],
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
            "Order and invoice records: 8 years, because tax law says so.",
            "Support messages: 24 months.",
            "Abandoned carts: 90 days after they last changed.",
            "Visit records, anonymous or not: 12 months after the visit.",
            "Marketing consent records: for as long as you are subscribed, plus 24 months as proof of consent.",
            "Anything we delete leaves our backups within 30 days.",
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
          text: `Write to the Grievance Officer in the last section. We acknowledge every request within ${P.grievanceAckHours} hours and answer it in full within ${P.grievanceResolution}. If you are not satisfied you may complain to the Data Protection Board of India.`,
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
      title: "Security",
      blocks: [
        {
          type: "p",
          text: "The site runs over TLS. There are no customer accounts, so there is no password of yours to leak. Access to customer data inside the business is limited to the people who need it and is logged. Payment credentials never reach us at all.",
        },
        {
          type: "p",
          text: "No system is perfect. If a breach affects your data we will notify you and the Data Protection Board as the DPDP Act requires.",
        },
      ],
    },
    {
      n: "13",
      title: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "If we change anything that materially affects you, we will publish the new version here, with a new date at the top, at least 14 days before the change takes effect, and email anyone with an order still in progress. Older versions are kept and can be requested.",
        },
      ],
    },
    {
      n: "14",
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

const PAYMENT_SECTION = "Payment"

const TERMS: Policy = {
  slug: "terms",
  title: "Terms of service",
  intro:
    "The deal between you and us when you buy a skull, from prices and delivery to returns, cancellations and the warranty. Short sentences, no traps.",
  readingTime: "~9 min read",
  shortVersion:
    "Buy it, we ship it. Don't like it? Send it back unused within 7 days. Don't hang a person off it.",
  accent: "blaze",
  updated: "2026-09-28",
  version: "1.0",
  sections: [
    {
      n: "01",
      title: "Agreeing to these terms",
      blocks: [
        {
          type: "p",
          text: `By using skelmet.in or placing an order you accept these terms. They form a contract between you and ${BUSINESS}, of ${ADDRESS}. If you do not accept them, do not order.`,
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
          text: "You must be 18 or older and able to enter a contract under the Indian Contract Act 1872. We currently ship only within India. Orders that look like resale or bulk arbitrage may be declined. For genuine bulk and club orders, talk to us first.",
        },
      ],
    },
    {
      n: "03",
      title: "No accounts",
      blocks: [
        {
          type: "p",
          text: "There are no customer accounts: everyone checks out as a guest. Your order number and the email address you ordered with are what identify your order, for tracking it and for anything you ask us about it, so keep the confirmation email. Anyone who has both can see where the order has got to.",
        },
      ],
    },
    {
      n: "04",
      title: "Products & descriptions",
      blocks: [
        {
          type: "p",
          text: "Every mount is 3D printed. That means small variations in layer texture and finish between units are normal and are not defects. They are the point of the product.",
        },
        {
          type: "p",
          text: "Colours on your screen will not match the physical filament exactly. The mount is rated to hold up to 10 kg.",
        },
      ],
    },
    {
      n: "05",
      title: "Prices & taxes",
      blocks: [
        {
          type: "p",
          text: [
            "Prices are in Indian Rupees and include GST. Shipping is charged on top where it applies, depending on your pincode, as the ",
            { text: "shipping policy", href: "/policies/shipping" },
            " explains. Checkout shows the shipping charge and the full total before you pay, and that total is what you pay, with no surprise fees at delivery.",
          ],
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
          text: "Your order is an offer to buy. The contract forms when we send the dispatch confirmation, not the order confirmation. Until then we may decline the order, because stock ran out, the address is not serviceable, or payment failed verification.",
        },
      ],
    },
    {
      n: "07",
      title: PAYMENT_SECTION,
      blocks: [
        {
          type: "p",
          // For paying online only; termsPolicy() states what is switched on.
          text: paymentCopy(DEFAULT_PAYMENT_OPTIONS).terms,
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
            `We dispatch within ${P.dispatchHours} hours of payment.`,
            `Delivery takes up to ${P.deliveryDays} from dispatch.`,
            `Risk passes to you on delivery. If the parcel arrives visibly damaged, refuse it or photograph it before opening and tell us within ${P.damageReportHours} hours of delivery.`,
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
          text: `You have ${P.returnDays} days from delivery to return a mount for any reason. It must be unused, undrilled, undamaged and in its original packaging. We arrange and pay for the reverse pickup.`,
        },
        {
          type: "p",
          text: `${REFUND_TIMING} A return is approved once it reaches us and passes inspection.`,
        },
        {
          type: "p",
          text: "The shipping charge you paid is refunded as well when the return is down to our mistake or a defect. It is not refunded when you return a mount because you changed your mind.",
        },
        {
          type: "p",
          text: "Custom-colour orders are made specifically for you and cannot be returned unless faulty.",
        },
      ],
    },
    {
      n: "10",
      title: "Cancellations",
      blocks: [
        {
          type: "p",
          text: [
            "Cancel free of charge any time before dispatch by ",
            { text: "contacting us", href: "/contact" },
            ` with your order number, and you get a full refund, shipping included. ${REFUND_TIMING} Once the parcel has left us it cannot be cancelled: use the returns process instead.`,
          ],
        },
      ],
    },
    {
      n: "11",
      title: "Warranty",
      blocks: [
        {
          type: "p",
          text: `We warrant the mount against cracking, deformation or bracket failure in normal indoor domestic use for ${siteConfig.promise.warrantyMonths} months from delivery. If that happens, send us a photo and we will replace it.`,
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
      n: "15",
      title: "Our intellectual property",
      blocks: [
        {
          type: "p",
          text: "The SKELMET name, the skull design, the 3D model files, the photography and the site itself are ours. Buying a mount buys you the object, not the design. You may not copy, 3D-scan, reproduce or sell the design, and you may not list our photography on a marketplace as your own.",
        },
        {
          type: "p",
          text: "Photographing your own mount and posting it is entirely fine, and encouraged.",
        },
      ],
    },
    {
      n: "16",
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
      n: "17",
      title: "Governing law",
      blocks: [
        {
          type: "p",
          text: "These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Gautam Buddha Nagar, Uttar Pradesh. Before going to court, please raise it with the Grievance Officer - most things get sorted there.",
        },
      ],
    },
    {
      n: "18",
      title: "Grievance officer",
      blocks: [
        { type: "p", text: "Appointed under the Consumer Protection (E-Commerce) Rules 2020:" },
        { type: "contact" },
      ],
    },
  ],
}

const shippingPolicy = (rule: ShippingRule): Policy => ({
  slug: "shipping",
  title: "Shipping policy",
  intro: `When it leaves, how it travels, and what happens if it goes wrong. Out within ${P.dispatchHours} hours of payment, and with you within ${P.deliveryDays} of dispatch.`,
  readingTime: "~4 min read",
  shortVersion: `${shippingTerms(rule).short} Dispatched within ${P.dispatchHours} hours of payment, delivered within ${P.deliveryDays} of dispatch.`,
  accent: "acid",
  updated: "2026-09-28",
  version: "1.0",
  sections: [
    {
      n: "01",
      title: "Where we ship",
      blocks: [
        {
          type: "p",
          text: "Everywhere in India that Shiprocket and its courier partners serve. Enter your pincode on the product page and we will tell you whether we deliver there, and what shipping costs, before you pay. We do not ship internationally yet. If you want one abroad, message us and we will quote a courier directly.",
        },
      ],
    },
    {
      n: "02",
      title: "What it costs",
      blocks: [
        {
          type: "p",
          text: shippingTerms(rule).cost,
        },
      ],
    },
    {
      n: "03",
      title: "Dispatch time",
      blocks: [
        {
          type: "p",
          text: `Every order is printed, finished, packed and handed to the courier within ${P.dispatchHours} hours of payment. If anything ever holds an order up, we email you rather than let you wonder.`,
        },
      ],
    },
    {
      n: "04",
      title: "Delivery time",
      blocks: [
        {
          type: "p",
          text: `Delivery takes up to ${P.deliveryDays} from dispatch, wherever you are in India. Once the parcel is moving, the courier's own estimate for your pincode shows on the tracking page.`,
        },
      ],
    },
    {
      n: "05",
      title: "Tracking",
      blocks: [
        {
          type: "p",
          text: [
            "The moment the parcel is handed to the courier you get an email with the AWB number and a live tracking link. You can also follow it on our ",
            { text: "Track order", href: "/track" },
            " page with your order number and email - there is no account to sign in to.",
          ],
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
          text: `Photograph the parcel before you open it further and send it to us within ${P.damageReportHours} hours of delivery. We ship a replacement immediately and we do not ask for the damaged one back.`,
        },
      ],
    },
    {
      n: "08",
      title: "Questions",
      blocks: [{ type: "contact" }],
    },
  ],
})

const SHIPPING = shippingPolicy(shippingConfig.fee)

const RETURNS: Policy = {
  slug: "returns",
  title: "Returns, refunds & cancellation",
  intro: `Seven days, no interrogation, and we pay the pickup. Refunds go back to the way you paid, within ${P.refundDays} of the return being approved.`,
  readingTime: "~4 min read",
  shortVersion:
    "Changed your mind? Seven days, unused, original box. We collect it and refund you. Cancel free any time before dispatch.",
  accent: "magenta",
  updated: "2026-10-01",
  version: "1.1",
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
            "In the original box with the screws, wall plugs and drilling template.",
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
            "We book a reverse pickup, at our cost, and tell you when to expect the courier.",
            "Repack it in the original box and hand it to the courier.",
            "We inspect it when it arrives, and approve the refund once it passes.",
          ],
        },
      ],
    },
    {
      n: "04",
      title: "Refund timing",
      blocks: [
        // One figure for every payment method. Quoting the outer edge is the
        // safe direction: a refund that lands early is a good surprise, one
        // that lands late is a complaint.
        { type: "p", text: REFUND_TIMING },
        {
          type: "p",
          text: "The shipping charge you paid is refunded as well when the return is down to our mistake or a defect. It is not refunded for a change-of-mind return, though the pickup is still on us.",
        },
      ],
    },
    {
      n: "05",
      title: "Faulty or wrong item",
      blocks: [
        {
          type: "p",
          text: `If it arrives cracked, warped, in the wrong colourway, or missing parts, send us a photo. We ship a replacement straight away and you keep or bin the original, whichever is less hassle. Damage in transit must be reported within ${P.damageReportHours} hours of delivery. Anything else is separate from the 7-day window and can be reported at any time within the ${P.warrantyMonths}-month warranty.`,
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
            "Custom-colour orders, unless faulty.",
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
          text: "Want a different colourway rather than your money back? Say so when you start the return and we ship the replacement as soon as the original is collected - you are not waiting on the refund first.",
        },
      ],
    },
    {
      n: "08",
      title: "Cancellation",
      blocks: [
        {
          type: "p",
          text: [
            "You can cancel any time before dispatch for a full refund, shipping included: ",
            { text: "contact us", href: "/contact" },
            ` with your order number. ${REFUND_TIMING}`,
          ],
        },
        {
          type: "p",
          text: "Once the parcel has been dispatched it can no longer be cancelled. Use the return process above instead.",
        },
      ],
    },
    {
      n: "09",
      title: "Questions",
      blocks: [{ type: "contact" }],
    },
  ],
}

export const POLICIES: Policy[] = [PRIVACY, TERMS, SHIPPING, RETURNS]

/** The terms, with their payment section stating the ways to pay in force. */
function termsPolicy(payment: PaymentOptions): Policy {
  return {
    ...TERMS,
    sections: TERMS.sections.map((section) =>
      section.title === PAYMENT_SECTION
        ? { ...section, blocks: [{ type: "p", text: paymentCopy(payment).terms }] }
        : section,
    ),
  }
}

/**
 * The policy, with the shipping policy stating `rule` - the charge checkout
 * applies - and the terms stating `payment`, the ways to pay it offers.
 */
export function getPolicy(
  slug: string,
  rule: ShippingRule = shippingConfig.fee,
  payment: PaymentOptions = DEFAULT_PAYMENT_OPTIONS,
): Policy | undefined {
  if (slug === SHIPPING.slug) return shippingPolicy(rule)
  if (slug === TERMS.slug) return termsPolicy(payment)
  return POLICIES.find((p) => p.slug === slug)
}
