/**
 * App-wide constants. Permission scopes are `<entity>:<verb>`, the module is
 * the entity, never a department (§3).
 */

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
  REFERRAL_READ: "referral:read",
  REFERRAL_APPROVE: "referral:approve",
  REVIEW_READ: "review:read",
  REVIEW_MODERATE: "review:moderate",
  INQUIRY_READ: "inquiry:read",
  INQUIRY_WRITE: "inquiry:write",
  SETTING_READ: "setting:read",
  SETTING_WRITE: "setting:write",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

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
  { scope: PERMISSIONS.REFERRAL_READ, module: "referral", label: "View referrals" },
  { scope: PERMISSIONS.REFERRAL_APPROVE, module: "referral", label: "Approve payouts" },
  { scope: PERMISSIONS.REVIEW_READ, module: "review", label: "View reviews" },
  { scope: PERMISSIONS.REVIEW_MODERATE, module: "review", label: "Moderate reviews" },
  { scope: PERMISSIONS.INQUIRY_READ, module: "inquiry", label: "View inquiries" },
  { scope: PERMISSIONS.INQUIRY_WRITE, module: "inquiry", label: "Reply to inquiries" },
  { scope: PERMISSIONS.SETTING_READ, module: "setting", label: "View settings" },
  { scope: PERMISSIONS.SETTING_WRITE, module: "setting", label: "Change settings" },
]

/** Order workflow: each transition is its own verb route with an atomic claim (§5). */
export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
}

/** Tone keys, not raw colours, StatusBadge maps these to tokens (§7). */
export const ORDER_STATUS_COLORS: Record<OrderStatus, "neutral" | "accent" | "success" | "danger"> =
  {
    PENDING: "neutral",
    PAID: "success",
    PACKED: "accent",
    SHIPPED: "accent",
    DELIVERED: "success",
    CANCELLED: "danger",
    RETURNED: "danger",
    REFUNDED: "neutral",
  }

export const PAGE_SIZE = 20
export const FREE_SHIPPING = true
export const COD_FEE = 49
export const BUNDLE_DISCOUNT = 299
export const REFERRAL_REWARD = 250
