// Permission scopes are `<entity>:<verb>`; the module is the entity, never a department.

export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  PRODUCT_READ: "product:read",
  PRODUCT_WRITE: "product:write",
  ORDER_READ: "order:read",
  ORDER_WRITE: "order:write",
  ORDER_FULFIL: "order:fulfil",
  ORDER_REFUND: "order:refund",
  COUPON_READ: "coupon:read",
  COUPON_WRITE: "coupon:write",
  REVIEW_READ: "review:read",
  REVIEW_MODERATE: "review:moderate",
  INQUIRY_READ: "inquiry:read",
  INQUIRY_WRITE: "inquiry:write",
  NEWSLETTER_READ: "newsletter:read",
  NEWSLETTER_SEND: "newsletter:send",
  POST_READ: "post:read",
  POST_PUBLISH: "post:publish",
  SETTING_READ: "setting:read",
  SETTING_WRITE: "setting:write",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Hold every permission (matched case-insensitively), and alone may delete orders. */
export const FULL_ACCESS_ROLES = ["Admin", "Owner"]

export const PERMISSION_DEFINITIONS: Array<{
  scope: Permission
  module: string
  label: string
}> = [
  { scope: PERMISSIONS.DASHBOARD_READ, module: "dashboard", label: "View dashboard" },
  { scope: PERMISSIONS.PRODUCT_READ, module: "product", label: "View products" },
  { scope: PERMISSIONS.PRODUCT_WRITE, module: "product", label: "Manage products" },
  { scope: PERMISSIONS.ORDER_READ, module: "order", label: "View orders" },
  { scope: PERMISSIONS.ORDER_WRITE, module: "order", label: "Edit orders" },
  { scope: PERMISSIONS.ORDER_FULFIL, module: "order", label: "Fulfil orders" },
  { scope: PERMISSIONS.ORDER_REFUND, module: "order", label: "Refund orders" },
  { scope: PERMISSIONS.COUPON_READ, module: "coupon", label: "View coupons" },
  { scope: PERMISSIONS.COUPON_WRITE, module: "coupon", label: "Manage coupons" },
  { scope: PERMISSIONS.REVIEW_READ, module: "review", label: "View reviews" },
  { scope: PERMISSIONS.REVIEW_MODERATE, module: "review", label: "Moderate reviews" },
  { scope: PERMISSIONS.INQUIRY_READ, module: "inquiry", label: "View inquiries" },
  { scope: PERMISSIONS.INQUIRY_WRITE, module: "inquiry", label: "Reply to inquiries" },
  {
    scope: PERMISSIONS.NEWSLETTER_READ,
    module: "newsletter",
    label: "View newsletter subscribers",
  },
  { scope: PERMISSIONS.NEWSLETTER_SEND, module: "newsletter", label: "Send newsletters" },
  { scope: PERMISSIONS.POST_READ, module: "post", label: "View blog posts" },
  { scope: PERMISSIONS.POST_PUBLISH, module: "post", label: "Publish and schedule blog posts" },
  { scope: PERMISSIONS.SETTING_READ, module: "setting", label: "View settings" },
  { scope: PERMISSIONS.SETTING_WRITE, module: "setting", label: "Change settings" },
]

/** Each transition is its own verb route with an atomic claim. */
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** The console's Orders page: paid or COD-confirmed, and every stage after. */
export const PAID_ORDER_STATUSES = [
  "CONFIRMED",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[]

export type OrderScope = "paid" | "all"

export function statusesIn(scope: OrderScope): readonly OrderStatus[] {
  return scope === "paid" ? PAID_ORDER_STATUSES : ORDER_STATUSES
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  CONFIRMED: "Confirmed · COD",
  PAID: "Paid",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
}

/** Tone keys, not colours: StatusBadge maps them to tokens. */
export const ORDER_STATUS_COLORS: Record<OrderStatus, "neutral" | "accent" | "success" | "danger"> =
  {
    PENDING: "neutral",
    CONFIRMED: "success",
    PAID: "success",
    PACKED: "accent",
    SHIPPED: "accent",
    DELIVERED: "success",
    CANCELLED: "danger",
    RETURNED: "danger",
    REFUNDED: "neutral",
  }

export const PAGE_SIZE = 20

/** Lists load a whole window so sorting and export cover the filtered set; bounded for safety. */
export const MAX_PAGE_SIZE = 200
