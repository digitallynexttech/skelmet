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
    // Always read fresh: this screen is where someone checks what is live.
    staleTime: 0,
  })
}

const patch = (path: string, body: unknown) =>
  apiFetch<RuntimeSettingsView>(path, { method: "PATCH", body: JSON.stringify(body) })

/**
 * Every save answers with the whole view, which replaces the cached one: no
 * refetch. Each save also sends back the version of its section this screen
 * was showing, so a save made on top of someone else's newer one is refused
 * (409) instead of silently undoing it; the refusal invalidates the view so
 * the newer settings load.
 */
export function useRuntimeSettingsMutations() {
  const qc = useQueryClient()
  const put = (view: RuntimeSettingsView) => qc.setQueryData(KEY, view)
  const reloadOnConflict = (err: unknown) => {
    if (err instanceof ApiFetchError && err.status === 409)
      void qc.invalidateQueries({ queryKey: KEY })
  }
  /** Undefined when nothing is cached: the server then checks against what it reads itself. */
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
