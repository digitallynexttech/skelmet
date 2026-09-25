import "server-only"

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { verifyPassword } from "@/lib/crypto"
import type { Permission } from "@/lib/constants"
import { clientIp, rateLimit } from "@/lib/rate-limit"
import { db } from "@/server/db"

/**
 * Auth.js v5, JWT sessions. The token carries identity and a snapshot of the
 * roles for display; the service guards re-read permissions from the database,
 * so a role change or a revoke takes effect on the next request (§6).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : ""
        const password = typeof raw?.password === "string" ? raw.password : ""
        if (!email || !password) return null

        // Checkout, coupons and contact were rate-limited; the one endpoint
        // that trades a guess for an account was not. Keyed on the address
        // rather than the email so cycling addresses does not reset the
        // budget, and rateLimit throws a 429 AppError, which Auth.js turns
        // into the same opaque failure as a wrong password - a blocked
        // attacker learns nothing a wrong guess would not have told them.
        try {
          rateLimit(`login:${clientIp(request.headers)}`, 10, 10 * 60_000)
        } catch {
          return null
        }

        // passwordHash is omitted by default in server/db.ts, so opt back in
        // here - the one place it is genuinely needed (§6).
        const user = await db.user.findUnique({
          where: { email },
          // select overrides the global omit in server/db.ts, which is the
          // one place passwordHash is genuinely needed.
          select: {
            id: true,
            email: true,
            name: true,
            kind: true,
            passwordHash: true,
            mustChangePassword: true,
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                    permissions: { select: { permission: { select: { scope: true } } } },
                  },
                },
              },
            },
          },
        })

        if (!user?.passwordHash) return null
        if (!(await verifyPassword(password, user.passwordHash))) return null

        const roles = user.roles.map((r) => r.role.name)
        const permissions = [
          ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.scope))),
        ] as Permission[]

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          kind: user.kind,
          roles,
          permissions,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    // No `trigger === "update"` branch, on purpose. Auth.js lets any signed-in
    // browser POST its own data to /api/auth/session and hands that data to this
    // callback as `session`; copying roles or permissions from it let a staff
    // member grant themselves every scope. Nothing here calls session.update(),
    // and the guards re-read permissions from the database (action-guard.ts), so
    // the token is only ever written from a verified login.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.kind = user.kind
        token.roles = user.roles
        token.permissions = user.permissions
        token.mustChangePassword = user.mustChangePassword
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.kind = token.kind
      session.user.roles = token.roles
      session.user.permissions = token.permissions
      session.user.mustChangePassword = token.mustChangePassword
      return session
    },
  },
})
