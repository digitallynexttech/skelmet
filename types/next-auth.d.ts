import type { DefaultSession } from "next-auth"

import type { Permission } from "@/lib/constants"

type UserKind = "STAFF" | "CUSTOMER"

/**
 * Required augmentation — without it every permission check fails to
 * compile (§6).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      kind: UserKind
      roles: string[]
      permissions: Permission[]
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }

  /** What `authorize()` returns and what the jwt callback receives. */
  interface User {
    id?: string
    kind: UserKind
    roles: string[]
    permissions: Permission[]
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    kind: UserKind
    roles: string[]
    permissions: Permission[]
    mustChangePassword: boolean
  }
}

export {}
