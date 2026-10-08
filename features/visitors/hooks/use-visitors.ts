"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import type { LinkedVisitor } from "@/features/visitors/server/linked-visitors"

// ── wire types ────────────────────────────────────────────
export type VisitorView = "all" | "known" | "anonymous" | "contact" | "cart" | "bought"

export type VisitorRow = {
  id: string
  /** Without consent: no IP, no contact, one visit. */
  anonymous: boolean
  name: string | null
  email: string | null
  phone: string | null
  ip: string | null
  city: string | null
  district: string | null
  region: string | null
  country: string | null
  deviceType: string | null
  deviceModel: string | null
  os: string | null
  browser: string | null
  source: string | null
  medium: string | null
  campaign: string | null
  landingPage: string | null
  referrer: string | null
  visitCount: number
  pageviews: number
  engagedSeconds: number
  cartItems: number
  cartValue: string
  /** Paid orders. */
  orders: number
  spent: string
  firstSeenAt: string
  lastSeenAt: string
}

export type VisitorListPayload = {
  data: VisitorRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  counts: Record<VisitorView, number>
}

export type VisitorEventRow = {
  id: string
  type: string
  path: string | null
  seconds: number
  data: Record<string, unknown> | null
  createdAt: string
}

export type VisitorSessionRow = {
  id: string
  startedAt: string
  lastSeenAt: string
  pageviews: number
  engagedSeconds: number
  landingPage: string | null
  exitPage: string | null
  source: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  ip: string | null
  city: string | null
  district: string | null
  region: string | null
  events: VisitorEventRow[]
}

export type CartLineRow = {
  name: string
  colourway: string
  sku: string
  qty: number
  unitPrice: string
}

export type VisitorDetail = Omit<VisitorRow, "orders" | "spent" | "cartItems" | "cartValue"> & {
  consentAt: string | null
  userAgent: string | null
  screen: string | null
  language: string | null
  timezone: string | null
  postalCode: string | null
  /** Typed at checkout; beats postalCode from the IP. */
  pincode: string | null
  /** Cloudflare's approximation; with consent only. */
  latitude: number | null
  longitude: number | null
  linked: LinkedVisitor[]
  customer: { id: string; name: string | null; email: string } | null
  cart: {
    updatedAt: string
    checkoutAt: string | null
    value: string
    items: CartLineRow[]
  } | null
  orders: Array<{ id: string; number: string; status: string; total: string; createdAt: string }>
  sessions: VisitorSessionRow[]
}

export type LeftCartRow = {
  id: string
  visitorId: string
  anonymous: boolean
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  district: string | null
  region: string | null
  deviceType: string | null
  deviceModel: string | null
  os: string | null
  browser: string | null
  source: string | null
  items: CartLineRow[]
  itemCount: number
  value: string
  checkoutAt: string | null
  updatedAt: string
  /** Seen in the last 30 minutes. */
  browsingNow: boolean
}

export type LeftCartsPayload = {
  data: LeftCartRow[]
  summary: { count: number; value: string; withContact: number; reachedCheckout: number }
}

// ── fetchers ──────────────────────────────────────────────
const getVisitors = (params: { view: VisitorView; q: string; days: string }) => {
  const search = new URLSearchParams({ view: params.view, days: params.days })
  if (params.q) search.set("q", params.q)
  return apiFetch<VisitorListPayload>(`/api/admin/visitors?${search}`)
}

const getVisitor = (id: string) => apiFetch<VisitorDetail>(`/api/admin/visitors/${id}`)

const getLeftCarts = () => apiFetch<LeftCartsPayload>("/api/admin/carts")

// ── queries ───────────────────────────────────────────────
export function useVisitors(params: { view: VisitorView; q: string; days: string }) {
  return useQuery({
    queryKey: ["visitors", params],
    queryFn: () => getVisitors(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useVisitor(id: string) {
  return useQuery({
    queryKey: ["visitors", id],
    queryFn: () => getVisitor(id),
    staleTime: 30_000,
  })
}

export function useLeftCarts() {
  return useQuery({
    queryKey: ["carts"],
    queryFn: getLeftCarts,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
