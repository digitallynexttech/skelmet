import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Wordmark } from "@/components/shared/wordmark"
import { ChangePasswordForm } from "@/features/account/components/change-password-form"
import { auth } from "@/server/auth"

export const metadata: Metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
}

/**
 * Deliberately in the (auth) group, not (app).
 *
 * The gate that sends people here lives in the (app) layout, so a page inside
 * that layout would be redirected to itself forever. Sitting beside /login
 * also matches what this is: a door, not a console screen.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login?next=/change-password")

  const { next } = await searchParams
  // Only ever an internal path, so a crafted ?next= cannot bounce someone
  // off-site after they authenticate.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin"
  const forced = session.user.mustChangePassword

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-14 sm:px-10">
      <div className="mx-auto w-full max-w-[400px]">
        <Wordmark className="mb-12" />

        <h1 className="font-display text-bone mb-3 text-[42px] leading-[1.02] uppercase sm:text-[52px]">
          {forced ? "Set a password" : "Change password"}
        </h1>
        <p className="text-ash mb-9 text-[15px] leading-[1.6]">
          {forced
            ? "Your account was opened with a temporary password. Pick your own before you carry on - whoever created the account can still see the old one."
            : "Pick something you have not used here before. You will be signed out and asked to sign in again with the new one."}
        </p>

        <ChangePasswordForm next={safeNext} />
      </div>
    </div>
  )
}
