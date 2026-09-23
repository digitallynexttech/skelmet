import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { Wordmark } from "@/components/shared/wordmark"
import { LoginForm } from "@/features/account/components/login-form"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // Only ever an internal path, so a crafted ?next= cannot bounce someone off-site.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin"

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-5 py-14 sm:px-10 xl:px-20">
        <Wordmark className="mb-12" />

        <div className="max-w-[400px]">
          <h1 className="font-display text-bone mb-3 text-[42px] leading-[1.02] uppercase sm:text-[52px]">
            Sign in
          </h1>
          <p className="text-ash mb-9 text-[15px] leading-[1.6]">
            The staff console. Customers never need this — orders are placed as a guest and
            tracked by order number.
          </p>

          <LoginForm next={safeNext} />

          <p className="text-dim mt-8 text-[13.5px]">
            Trouble getting in?{" "}
            <Link href="/contact" className="text-ember hover:text-flare">
              Tell us
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="/product/lifestyle-garage.jpg"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-void)_0%,rgb(7_6_10_/_0.4)_40%,rgb(7_6_10_/_0.15)_100%)]" />
      </div>
    </div>
  )
}
