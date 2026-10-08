"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { PaymentMethod } from "@/features/checkout/payment-options"
import type { DeliveryState, FulfilmentState, PaymentState } from "@/features/orders/order-progress"
import type { OrderView } from "@/features/orders/order-views"
import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE, type OrderScope, type OrderStatus } from "@/lib/constants"
import { mutationWithToast } from "@/lib/query"

// ── wire types ────────────────────────────────────────────
export type OrderRow = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  email: string
  phone: string
  total: string
  /** What the courier still collects: the total for COD, the balance for PARTIAL. */
  dueOnDelivery: string
  itemCount: number
  customer: string
  location: string
  payment: PaymentState
  fulfilment: FulfilmentState
  delivery: DeliveryState | null
  /** Paid through Razorpay's test account. */
  testPayment: boolean
  createdAt: string
  placedAt: string | null
}

export type OrderDetail = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  email: string
  phone: string
  subtotal: string
  discount: string
  shipping: string
  /** The pay-on-delivery charge, included in `total`. */
  paymentFee: string
  tax: string
  total: string
  dueOnDelivery: string
  shippingAddress: Record<string, string | boolean>
  createdAt: string
  placedAt: string | null
  /** e.g. SKM/26-27/0001, once issued. */
  invoiceNumber: string | null
  invoicedAt: string | null
  /** Sent automatically on delivery. */
  invoiceEmailedAt: string | null
  coupon: { code: string; kind: string; value: string } | null
  items: Array<{
    id: string
    qty: number
    unitPrice: string
    nameSnapshot: string
    variant: { sku: string; colourway: string }
  }>
  payments: Array<{
    gateway: string
    gatewayOrderId: string
    gatewayPaymentId: string | null
    status: string
    amount: string
    mode: "test" | "live" | null
    createdAt: string
  }>
  shipment: {
    courier: string
    awb: string | null
    status: string
    provider: "shiprocket" | "manual" | string
    labelUrl: string | null
    manifestUrl: string | null
    pickupScheduledAt: string | null
    etd: string | null
    statusAt: string | null
    shippedAt: string | null
    deliveredAt: string | null
    trackingUrl: string | null
  } | null
  user: { id: string; name: string | null; email: string } | null
  shiprocket: { configured: boolean; orderId: string | null }
}

export type CourierOption = {
  id: number
  name: string
  rate: number
  etd: string | null
  days: number | null
  rating: number | null
  recommended: boolean
}

export type CourierOptions = { options: CourierOption[]; recommendedId: number | null }

export type Dashboard = {
  todayCount: number
  weekRevenue: string
  awaiting: number
  lowStock: Array<{ sku: string; colourway: string; stock: number }>
  recent: OrderRow[]
}

export type OrderListPayload = Paginated<OrderRow> & {
  counts: Record<OrderStatus, number>
  viewCounts: Record<OrderView, number>
  allCount: number
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

/** An online order placed and never paid for. */
export type UnpaidOrderRow = {
  id: string
  number: string
  /** open: within its hour. expired: stock back on sale. cancelled: by a person. */
  state: "open" | "expired" | "cancelled"
  /** failed: declined. closed: payment window left. none: it never opened. */
  payment: "failed" | "closed" | "none"
  customer: string
  firstName: string
  email: string
  phone: string
  city: string
  items: Array<{ name: string; qty: number }>
  itemCount: number
  total: string
  createdAt: string
  /** A later paid order by the same email or phone. */
  recoveredBy: { id: string; number: string } | null
  visitorId: string | null
  source: string | null
  deviceType: string | null
}

export type UnpaidOrdersPayload = {
  data: UnpaidOrderRow[]
  /** lost: past its hour and not paid on any order since. */
  summary: { open: number; lost: number; recovered: number; lostValue: string }
}

// ── fetchers ──────────────────────────────────────────────
const getDashboard = () => apiFetch<Dashboard>("/api/admin/dashboard")

const getUnpaidOrders = () => apiFetch<UnpaidOrdersPayload>("/api/admin/orders/abandoned")

type OrderListParams = {
  page: number
  scope: OrderScope
  status: OrderStatus | "ALL"
  view: OrderView
  q: string
}

const getOrders = (params: OrderListParams) => {
  const search = new URLSearchParams({
    page: String(params.page),
    scope: params.scope,
    status: params.status,
    view: params.view,
    // The console sorts and exports client-side, so it needs the whole window.
    pageSize: String(MAX_PAGE_SIZE),
  })
  if (params.q) search.set("q", params.q)
  return apiFetch<OrderListPayload>(`/api/admin/orders?${search}`)
}

const getOrder = (id: string) => apiFetch<OrderDetail>(`/api/admin/orders/${id}`)

const postVerb = (id: string, verb: string, body?: unknown) =>
  apiFetch<{ id: string; status: OrderStatus }>(`/api/admin/orders/${id}/${verb}`, {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

// ── queries ───────────────────────────────────────────────
export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, staleTime: 30_000 })
}

export type TestOrderPlan = {
  deletable: Array<{
    id: string
    number: string
    customer: string
    total: string
    testPayment: boolean
  }>
  kept: Array<{ id: string; number: string; reason: string }>
  deleted: boolean
}

/** Without `confirm`, a preview: nothing is deleted. */
export const planTestOrderDeletion = (ids: string[], confirm = false) =>
  apiFetch<TestOrderPlan>("/api/admin/orders/delete-test", {
    method: "POST",
    body: JSON.stringify({ ids, confirm }),
  })

/** Invalidates: ["orders"], ["unpaid-orders"], ["dashboard"] */
export function useDeleteTestOrders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => planTestOrderDeletion(ids, true),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] })
      void qc.invalidateQueries({ queryKey: ["unpaid-orders"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUnpaidOrders() {
  return useQuery({
    queryKey: ["unpaid-orders"],
    queryFn: getUnpaidOrders,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: () => getOrder(id),
    staleTime: 30_000,
  })
}

/** Only when asked for: each call is a rate lookup on the Shiprocket account. */
export function useCourierOptions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["orders", id, "couriers"],
    queryFn: () => apiFetch<CourierOptions>(`/api/admin/orders/${id}/couriers`),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// ── mutations ─────────────────────────────────────────────
/** Invalidates: ["orders"], ["unpaid-orders"], ["dashboard"] */
export function useOrderAction(id: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["orders"] })
    void qc.invalidateQueries({ queryKey: ["unpaid-orders"] })
    void qc.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const pack = useMutation({
    mutationFn: mutationWithToast(() => postVerb(id, "pack"), {
      loading: "Marking packed…",
      success: "Order marked packed",
    }),
    onSuccess: invalidate,
  })

  const ship = useMutation({
    mutationFn: mutationWithToast(
      (input: { courier: string; awb: string }) => postVerb(id, "ship", input),
      { loading: "Marking shipped…", success: "Order marked shipped" },
    ),
    onSuccess: invalidate,
  })

  const deliver = useMutation({
    mutationFn: mutationWithToast(() => postVerb(id, "deliver"), {
      loading: "Marking delivered…",
      success: "Order marked delivered",
    }),
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: mutationWithToast(() => postVerb(id, "cancel"), {
      loading: "Cancelling…",
      success: "Order cancelled, stock returned",
    }),
    onSuccess: invalidate,
  })

  const refund = useMutation({
    mutationFn: mutationWithToast(() => postVerb(id, "refund"), {
      loading: "Issuing refund…",
      success: "Refund issued",
    }),
    onSuccess: invalidate,
  })

  // Settled: a booking that failed at pickup still has an AWB to show.
  const book = useMutation({
    mutationFn: mutationWithToast((input: { courierId?: number }) => postVerb(id, "book", input), {
      loading: "Booking the courier…",
      success: "Courier booked, pickup scheduled",
    }),
    onSettled: invalidate,
  })

  const refreshTracking = useMutation({
    mutationFn: mutationWithToast(() => postVerb(id, "tracking"), {
      loading: "Asking Shiprocket…",
      success: "Tracking updated",
    }),
    onSuccess: invalidate,
  })

  const emailInvoice = useMutation({
    mutationFn: mutationWithToast(
      () =>
        apiFetch<{ invoiceNumber: string; emailedAt: string; to: string }>(
          `/api/admin/orders/${id}/invoice/email`,
          { method: "POST" },
        ),
      { loading: "Emailing the invoice…", success: "Invoice emailed to the customer" },
    ),
    // Settled, not success: a failed send may still have issued the number.
    onSettled: invalidate,
  })

  return { pack, ship, deliver, cancel, refund, book, refreshTracking, emailInvoice }
}
