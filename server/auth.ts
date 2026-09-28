import "server-only"

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { SESSION_IDLE_SECONDS, tokenStillValid } from "@/server/session-policy"
import { authorizeStaff } from "@/server/staff-login"

/**
 * Auth.js v5, JWT sessions. The token carries identity and a snapshot of the
 * roles for display; the service guards re-read permissions from the database,
 * so a role change or a revoke takes effect on the next request (§6).
 *
 * The token also carries `sessionVersion` and `loginAt` (server/session-policy.ts):
 * every read checks the version against the user's row and the sign-in time
 * against the absolute lifetime, and ends the session when either has moved on.
 */
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
    // No `trigger === "update"` branch, on purpose. Auth.js lets any signed-in
    // browser POST its own data to /api/auth/session and hands that data to this
    // callback as `session`; copying roles or permissions from it let a staff
    // member grant themselves every scope. Nothing here calls session.update(),
    // and the guards re-read permissions from the database (action-guard.ts), so
    // the token is only ever written from a verified login.
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
      // Read back by the guards (sessionClaims in server/session-policy.ts).
      Object.assign(session.user, { sessionVersion: token.sessionVersion, loginAt: token.loginAt })
      return session
    },
  },
})
