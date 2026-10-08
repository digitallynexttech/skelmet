"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  PaymentMode,
  PaymentOptions,
  PaymentSettingsInput,
  RuntimeSettingsView,
  SettingVersions,
  ShippingCharge,
  ShiprocketSettingsInput,
} from "@/features/settings/schemas/runtime-settings.schema"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

const KEY = ["runtime-settings"] as const

export function useRuntimeSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<RuntimeSettingsView>("/api/admin/settings"),
    // Always fresh: this is where someone checks what is live.
    staleTime: 0,
  })
}

const patch = (path: string, body: unknown) =>
  apiFetch<RuntimeSettingsView>(path, { method: "PATCH", body: JSON.stringify(body) })

/**
 * A save returns the whole view, which replaces the cache. Each sends its section's `version`; a
 * 409 (someone saved since) reloads the view.
 */
export function useRuntimeSettingsMutations() {
  const qc = useQueryClient()
  const put = (view: RuntimeSettingsView) => qc.setQueryData(KEY, view)
  const reloadOnConflict = (err: unknown) => {
    if (err instanceof ApiFetchError && err.status === 409)
      void qc.invalidateQueries({ queryKey: KEY })
  }
  // Undefined when nothing is cached: the server then checks against its own read.
  const versionOf = (section: keyof SettingVersions) =>
    qc.getQueryData<RuntimeSettingsView>(KEY)?.versions?.[section]

  const savePayment = useMutation({
    mutationFn: mutationWithToast(
      (input: PaymentSettingsInput) =>
        patch("/api/admin/settings/payment", { ...input, version: versionOf("payment") }),
      { loading: "Saving Razorpay settings…", success: "Razorpay settings saved" },
    ),
    onSuccess: put,
    onError: reloadOnConflict,
  })

  const saveShiprocket = useMutation({
    mutationFn: mutationWithToast(
      (input: ShiprocketSettingsInput) =>
        patch("/api/admin/settings/shiprocket", { ...input, version: versionOf("shiprocket") }),
      { loading: "Saving Shiprocket settings…", success: "Shiprocket settings saved" },
    ),
    onSuccess: put,
    onError: reloadOnConflict,
  })

  const saveShipping = useMutation({
    mutationFn: mutationWithToast(
      (input: ShippingCharge) =>
        patch("/api/admin/settings/shipping", { ...input, version: versionOf("shipping") }),
      { loading: "Saving the shipping charge…", success: "Shipping charge saved" },
    ),
    onSuccess: put,
    onError: reloadOnConflict,
  })

  const saveCheckout = useMutation({
    mutationFn: mutationWithToast(
      (input: PaymentOptions) =>
        patch("/api/admin/settings/checkout", { ...input, version: versionOf("checkout") }),
      { loading: "Saving the ways to pay…", success: "Ways to pay saved" },
    ),
    onSuccess: put,
    onError: reloadOnConflict,
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

  return { savePayment, saveShiprocket, saveShipping, saveCheckout, testPayment, testShiprocket }
}
