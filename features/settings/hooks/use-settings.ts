"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api-fetch"
import { mutationWithToast } from "@/lib/query"

export type StaffRow = {
  id: string
  name: string | null
  email: string
  roles: Array<{ id: string; name: string }>
  mustChangePassword: boolean
  createdAt: string
}

export type RoleRow = {
  id: string
  name: string
  description: string | null
  permissions: string[]
  staffCount: number
}

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () => apiFetch<{ staff: StaffRow[]; roles: RoleRow[] }>("/api/admin/staff"),
    staleTime: 30_000,
  })
}

/** Invalidates: ["staff"] */
export function useStaffMutations() {
  const qc = useQueryClient()
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["staff"] })

  const create = useMutation({
    mutationFn: mutationWithToast(
      (input: { name: string; email: string; password: string; roleIds: string[] }) =>
        apiFetch<StaffRow>("/api/admin/staff", { method: "POST", body: JSON.stringify(input) }),
      { loading: "Adding employee…", success: "Employee added" },
    ),
    onSuccess: invalidate,
  })

  const setRoles = useMutation({
    mutationFn: mutationWithToast(
      ({ id, roleIds }: { id: string; roleIds: string[] }) =>
        apiFetch<StaffRow>(`/api/admin/staff/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ roleIds }),
        }),
      { loading: "Saving roles…", success: "Roles saved" },
    ),
    onSuccess: invalidate,
  })

  const resetPassword = useMutation({
    mutationFn: mutationWithToast(
      ({ id, password }: { id: string; password: string }) =>
        apiFetch<StaffRow>(`/api/admin/staff/${id}/password`, {
          method: "POST",
          body: JSON.stringify({ password }),
        }),
      { loading: "Resetting…", success: "Password reset, they must change it at next sign in" },
    ),
    onSuccess: invalidate,
  })

  const revoke = useMutation({
    mutationFn: mutationWithToast(
      (id: string) => apiFetch<{ id: string }>(`/api/admin/staff/${id}`, { method: "DELETE" }),
      { loading: "Revoking access…", success: "Console access revoked" },
    ),
    onSuccess: invalidate,
  })

  return { create, setRoles, resetPassword, revoke }
}
