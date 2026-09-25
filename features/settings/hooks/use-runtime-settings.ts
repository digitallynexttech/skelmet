"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  PaymentMode,
  PaymentSettingsInput,
  RuntimeSettingsView,
  ShippingCharge,
  ShiprocketSettingsInput,
} from "@/features/settings/schemas/runtime-settings.schema"
import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

const KEY = ["runtime-settings"] as const

export function useRuntimeSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<RuntimeSettingsView>("/api/admin/settings"),
    // Always read fresh: this screen is where someone checks what is live.
    staleTime: 0,
  })
}

const patch = (path: string, body: unknown) =>
  apiFetch<RuntimeSettingsView>(path, { method: "PATCH", body: JSON.stringify(body) })

/** Every save answers with the whole view, which replaces the cached one: no refetch. */
export function useRuntimeSettingsMutations() {
  const qc = useQueryClient()
  const put = (view: RuntimeSettingsView) => qc.setQueryData(KEY, view)

  const savePayment = useMutation({
    mutationFn: mutationWithToast(
      (input: PaymentSettingsInput) => patch("/api/admin/settings/payment", input),
      { loading: "Saving Razorpay settings…", success: "Razorpay settings saved" },
    ),
    onSuccess: put,
  })

  const saveShiprocket = useMutation({
    mutationFn: mutationWithToast(
      (input: ShiprocketSettingsInput) => patch("/api/admin/settings/shiprocket", input),
      { loading: "Saving Shiprocket settings…", success: "Shiprocket settings saved" },
    ),
    onSuccess: put,
  })

  const saveShipping = useMutation({
    mutationFn: mutationWithToast(
      (input: ShippingCharge) => patch("/api/admin/settings/shipping", input),
      { loading: "Saving the shipping charge…", success: "Shipping charge saved" },
    ),
    onSuccess: put,
  })

  const testPayment = useMutation({
    mutationFn: mutationWithToast(
      (mode: PaymentMode) =>
        apiFetch<{ mode: PaymentMode }>("/api/admin/settings/payment/test", {
          method: "POST",
          body: JSON.stringify({ mode }),
        }),
      { loading: "Asking Razorpay…", success: "Razorpay accepted the keys" },
    ),
  })

  const testShiprocket = useMutation({
    mutationFn: mutationWithToast(
      () =>
        apiFetch<{ pickup: { name: string; pincode: string } | null }>(
          "/api/admin/settings/shiprocket/test",
          { method: "POST" },
        ),
      { loading: "Logging in to Shiprocket…", success: "Logged in to Shiprocket" },
    ),
  })

  return { savePayment, saveShiprocket, saveShipping, testPayment, testShiprocket }
}
