"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { OrderStatus } from "@/lib/constants"
import { mutationWithToast } from "@/lib/query"

// ── wire types ────────────────────────────────────────────
export type OrderRow = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: "ONLINE" | "COD"
  email: string
  phone: string
  total: string
  itemCount: number
  customer: string
  city: string
  createdAt: string
  placedAt: string | null
}

export type OrderDetail = {
  id: string
  number: string
  status: OrderStatus
  paymentMethod: "ONLINE" | "COD"
  email: string
  phone: string
  subtotal: string
  discount: string
  shipping: string
  tax: string
  total: string
  shippingAddress: Record<string, string | boolean>
  createdAt: string
  placedAt: string | null
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
    createdAt: string
  }>
  shipment: {
    courier: string
    awb: string | null
    status: string
    shippedAt: string | null
    deliveredAt: string | null
  } | null
  user: { id: string; name: string | null; email: string } | null
}

export type Dashboard = {
  todayCount: number
  weekRevenue: string
  awaiting: number
  lowStock: Array<{ sku: string; colourway: string; stock: number }>
  recent: OrderRow[]
}

type Paginated<T> = {
  data: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

// ── fetchers ──────────────────────────────────────────────
const getDashboard = () => apiFetch<Dashboard>("/api/admin/dashboard")

const getOrders = (params: { page: number; status: OrderStatus | "ALL"; q: string }) => {
  const search = new URLSearchParams({ page: String(params.page), status: params.status })
  if (params.q) search.set("q", params.q)
  return apiFetch<Paginated<OrderRow>>(`/api/admin/orders?${search}`)
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

export function useOrders(params: { page: number; status: OrderStatus | "ALL"; q: string }) {
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

// ── mutations ─────────────────────────────────────────────
/** Invalidates: ["orders"], ["dashboard"] */
export function useOrderAction(id: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["orders"] })
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

  return { pack, ship, deliver, cancel, refund }
}
