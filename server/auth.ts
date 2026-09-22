import "server-only"

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { verifyPassword } from "@/lib/crypto"
import type { Permission } from "@/lib/constants"
import { db } from "@/server/db"

/**
 * Auth.js v5, JWT sessions. Permissions ride the token so a request costs zero
 * database reads; a role change takes effect on the next `session.update()` or
 * re-login (§6).
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
      async authorize(raw) {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : ""
        const password = typeof raw?.password === "string" ? raw.password : ""
        if (!email || !password) return null

        // passwordHash is omitted by default in server/db.ts, so opt back in
        // here — the one place it is genuinely needed (§6).
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
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.kind = user.kind
        token.roles = user.roles
        token.permissions = user.permissions
        token.mustChangePassword = user.mustChangePassword
      }
      if (trigger === "update" && session?.user) {
        token.roles = session.user.roles ?? token.roles
        token.permissions = session.user.permissions ?? token.permissions
        token.mustChangePassword = session.user.mustChangePassword ?? token.mustChangePassword
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
