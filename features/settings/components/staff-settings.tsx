"use client"

import * as React from "react"
import { KeyRound, ShieldOff, UserPlus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { HeaderButton } from "@/components/ui/header-button"
import { Field, Input } from "@/components/ui/input"
import {
  useStaff,
  useStaffMutations,
  type RoleRow,
  type StaffRow,
} from "@/features/settings/hooks/use-settings"
import { useConfirm, type Ask } from "@/hooks/use-confirm"
import { ApiFetchError } from "@/lib/api-fetch"

function AddStaffForm({ roles, onDone }: { roles: RoleRow[]; onDone: () => void }) {
  const { create } = useStaffMutations()
  const [roleIds, setRoleIds] = React.useState<string[]>([])
  // The server's field errors, shown under each box as well as in the toast.
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const toggle = (id: string) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        setFields({})
        create.mutate(
          {
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
            roleIds,
          },
          {
            onSuccess: onDone,
            onError: (err) => {
              if (err instanceof ApiFetchError) setFields(err.fieldErrors)
            },
          },
        )
      }}
      className="rounded-card bg-carbon border border-white/[0.09] p-6"
    >
      <h2 className="text-bone mb-5 text-[15px] font-semibold">Add an employee</h2>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fields.name}>
          <Input name="name" required placeholder="Priya Sharma" />
        </Field>
        <Field label="Work email" error={fields.email}>
          <Input name="email" type="email" required placeholder="priya@skelmet.in" />
        </Field>
        <Field
          label="Temporary password"
          hint="10 characters at least. They change it the first time they sign in"
          error={fields.password}
        >
          <Input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
          />
        </Field>
      </div>

      <fieldset className="mb-5">
        <legend className="text-dim mb-3 font-mono text-[10.5px] tracking-[0.16em] uppercase">
          Roles
        </legend>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={roleIds.includes(r.id)}
              className={
                roleIds.includes(r.id)
                  ? "bg-blaze text-void rounded-full px-4 py-2 text-[12.5px] font-semibold"
                  : "text-ash hover:text-bone rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30"
              }
            >
              {r.name}
              <span className="ml-2 font-mono text-[10.5px] opacity-70">
                {r.permissions.length}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2.5">
        <HeaderButton
          type="submit"
          variant="primary"
          disabled={create.isPending || roleIds.length === 0}
        >
          Add employee
        </HeaderButton>
        <HeaderButton type="button" variant="quiet" onClick={onDone}>
          Cancel
        </HeaderButton>
      </div>
    </form>
  )
}

function StaffCard({ member, roles, ask }: { member: StaffRow; roles: RoleRow[]; ask: Ask }) {
  const { setRoles, resetPassword, revoke } = useStaffMutations()
  const [resetting, setResetting] = React.useState(false)
  const busy = setRoles.isPending || resetPassword.isPending || revoke.isPending

  const held = new Set(member.roles.map((r) => r.id))

  return (
    <article className="rounded-card bg-carbon border border-white/[0.09] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-bone text-[16px] font-semibold">{member.name ?? "Unnamed"}</h3>
          <p className="text-ash font-mono text-[12px]">{member.email}</p>
          {member.mustChangePassword ? (
            <Badge variant="ember" className="mt-2.5">
              Must change password
            </Badge>
          ) : null}
        </div>

        <div className="flex gap-2">
          <HeaderButton className="px-3" disabled={busy} onClick={() => setResetting((v) => !v)}>
            <KeyRound className="size-3.5" strokeWidth={1.9} />
            Reset password
          </HeaderButton>
          <HeaderButton
            className="px-3"
            disabled={busy}
            onClick={() =>
              ask({
                title: `Revoke ${member.name ?? member.email}?`,
                body: "They are signed out and can no longer sign in. Adding them again later needs a new temporary password.",
                confirmLabel: "Revoke access",
                tone: "danger",
                run: (done) => revoke.mutate(member.id, { onSettled: done }),
              })
            }
          >
            <ShieldOff className="size-3.5" strokeWidth={1.9} />
            Revoke
          </HeaderButton>
        </div>
      </div>

      {resetting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            resetPassword.mutate(
              { id: member.id, password: String(form.get("password") ?? "") },
              { onSuccess: () => setResetting(false) },
            )
          }}
          className="rounded-tile bg-void mb-5 flex flex-wrap items-end gap-3 border border-white/[0.09] p-4"
        >
          <Field label="New temporary password" className="flex-1 sm:min-w-[260px]">
            <Input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
            />
          </Field>
          <HeaderButton type="submit" variant="primary" disabled={busy}>
            Set
          </HeaderButton>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={busy}
            aria-pressed={held.has(r.id)}
            onClick={() => {
              const next = held.has(r.id)
                ? member.roles.filter((x) => x.id !== r.id).map((x) => x.id)
                : [...member.roles.map((x) => x.id), r.id]
              setRoles.mutate({ id: member.id, roleIds: next })
            }}
            className={
              held.has(r.id)
                ? "bg-violet text-bone rounded-full px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
                : "text-ash hover:text-bone rounded-full border border-white/[0.14] px-4 py-2 text-[12.5px] transition-colors hover:border-white/30 disabled:opacity-50"
            }
          >
            {r.name}
          </button>
        ))}
      </div>
    </article>
  )
}

/** The Team tab of Settings. */
export function StaffSettings() {
  const { data, isLoading, isError, error } = useStaff()
  const [adding, setAdding] = React.useState(false)
  const { ask, dialog } = useConfirm()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-14 w-64 animate-pulse rounded-xl bg-white/5" />
        <div className="rounded-card h-72 animate-pulse bg-white/5" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load settings"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    )
  }

  const staff = data?.staff ?? []
  const roles = data?.roles ?? []

  const addButton = !adding ? (
    <HeaderButton variant="primary" onClick={() => setAdding(true)}>
      <UserPlus className="size-4" strokeWidth={1.9} />
      Add employee
    </HeaderButton>
  ) : null
  const description =
    "Who can sign in, and what each of them can do. A role is a bundle of permissions, so access is granted by job rather than one checkbox at a time."

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-bone text-[15px] font-semibold">Staff and roles</h2>
          <p className="text-ash mt-1.5 max-w-[560px] text-[13px] leading-[1.6]">{description}</p>
        </div>
        {addButton}
      </div>

      {adding ? <AddStaffForm roles={roles} onDone={() => setAdding(false)} /> : null}

      <div className="flex flex-col gap-4">
        {staff.map((m) => (
          <StaffCard key={m.id} member={m} roles={roles} ask={ask} />
        ))}
      </div>

      <section className="rounded-card bg-carbon border border-white/[0.09] p-6">
        <h2 className="text-bone mb-4 text-[15px] font-semibold">What each role can do</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id}>
              <div className="mb-2 flex items-baseline gap-2.5">
                <span className="text-bone text-[14.5px] font-semibold">{r.name}</span>
                <span className="text-dim font-mono text-[11px]">
                  {r.staffCount} {r.staffCount === 1 ? "person" : "people"}
                </span>
              </div>
              {r.description ? (
                <p className="text-ash mb-2.5 text-[13px]">{r.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className="text-ash rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10.5px]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-dim mt-5 border-t border-white/[0.07] pt-4 text-[13px]">
          Roles and permissions themselves are defined in code and applied with{" "}
          <span className="text-ash font-mono">pnpm db:sync-permissions</span>, so a wrong click
          here cannot silently widen what a role is allowed to do.
        </p>
      </section>
    </div>
  )
}
