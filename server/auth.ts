import "server-only"

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { SESSION_IDLE_SECONDS, tokenStillValid } from "@/server/session-policy"
import { authorizeStaff } from "@/server/staff-login"

// The token's roles are for display only: guards re-read permissions from the
// database. `sessionVersion` and `loginAt` end sessions (session-policy.ts).
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_IDLE_SECONDS },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (raw, request) => authorizeStaff(raw, request.headers),
    }),
  ],
  callbacks: {
    // Security: no `trigger === "update"` branch. Any signed-in browser can POST
    // its own `session` data to /api/auth/session; copying it would let staff
    // grant themselves every scope. The token is written only at login.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.kind = user.kind
        token.roles = user.roles
        token.permissions = user.permissions
        token.mustChangePassword = user.mustChangePassword
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0
        token.loginAt = Date.now()
        return token
      }
      // null signs this browser out: Auth.js clears the cookie.
      return (await tokenStillValid(token)) ? token : null
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.kind = token.kind
      session.user.roles = token.roles
      session.user.permissions = token.permissions
      session.user.mustChangePassword = token.mustChangePassword
      // Read back by sessionClaims().
      Object.assign(session.user, { sessionVersion: token.sessionVersion, loginAt: token.loginAt })
      return session
    },
  },
})
