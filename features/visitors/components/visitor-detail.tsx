"use client"

import Link from "next/link"
import {
  Compass,
  Eye,
  Link2,
  MapPin,
  MousePointerClick,
  ShoppingBag,
  ShoppingCart,
  UserCheck,
  Users,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { StatTile } from "@/components/shared/stat-tile"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { ContactActions } from "@/features/visitors/components/contact-actions"
import { DeviceIcon } from "@/features/visitors/components/device-icon"
import {
  useVisitor,
  type VisitorDetail,
  type VisitorEventRow,
  type VisitorSessionRow,
} from "@/features/visitors/hooks/use-visitors"
import { duration, placeLine, sourceLine, visitorName, when } from "@/features/visitors/lib/format"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants"
import { regionOf } from "@/lib/india"

/**
 * One visitor: who they are if they have said, what they browse on, where
 * they came from, and every visit - page by page, with the time spent on
 * each, the cart as it changed, and where they stopped.
 */

function Card({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-carbon rounded-md border border-white/[0.09] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        {icon}
        <h2 className="text-bone text-[15px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/** A label and its value; nothing at all when there is no value. */
function Fact({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.06] py-2 first:border-t-0 first:pt-0">
      <dt className="text-dim shrink-0 text-[12.5px]">{label}</dt>
      <dd
        className={
          mono
            ? "text-ash min-w-0 text-right font-mono text-[12px] break-all"
            : "text-bone min-w-0 text-right text-[13.5px] break-words"
        }
      >
        {value}
      </dd>
    </div>
  )
}

/** The list a visitor is opened from, which the header links back to. */
const VISITORS = { label: "Visitors", href: "/admin/customers/visitors" }

const isOrderStatus = (s: string): s is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(s)

const itemsIn = (data: Record<string, unknown> | null) =>
  Array.isArray(data?.items)
    ? (data.items as Array<{ sku?: string; qty?: number }>)
        .map((i) => `${i.qty ?? 1} × ${i.sku ?? "?"}`)
        .join(", ")
    : ""

/** One line of a visit, in words. */
function EventLine({ event, start }: { event: VisitorEventRow; start: string }) {
  const offset = Math.max(
    0,
    (new Date(event.createdAt).getTime() - new Date(start).getTime()) / 1000,
  )
  const data = event.data

  let icon = <Eye className="text-dim size-3.5" strokeWidth={1.9} />
  let text: React.ReactNode = event.path ?? "A page"
  let tail: string | null = event.seconds > 0 ? duration(event.seconds) : null

  if (event.type === "cart") {
    icon = <ShoppingCart className="text-ember size-3.5" strokeWidth={1.9} />
    const items = itemsIn(data)
    text = items ? `Cart: ${items}` : "Emptied the cart"
    tail = typeof data?.value === "string" && Number(data.value) > 0 ? `₹${data.value}` : null
  } else if (event.type === "checkout") {
    icon = <ShoppingCart className="text-blaze size-3.5" strokeWidth={1.9} />
    text = `Reached checkout with ${itemsIn(data)}`
    tail = typeof data?.value === "string" ? `₹${data.value}` : null
  } else if (event.type === "contact") {
    icon = <UserCheck className="text-acid size-3.5" strokeWidth={1.9} />
    const fields = Array.isArray(data?.fields) ? (data.fields as string[]).join(", ") : "details"
    text = `Typed their ${fields} at checkout`
    tail = null
  } else if (event.type === "placed") {
    icon = <ShoppingBag className="text-acid size-3.5" strokeWidth={1.9} />
    text = typeof data?.number === "string" ? `Placed order ${data.number}` : "Placed an order"
    tail = null
  } else if (event.type === "consent") {
    icon = <MousePointerClick className="text-acid size-3.5" strokeWidth={1.9} />
    text = "Accepted cookies"
    tail = null
  }

  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="text-dim w-12 shrink-0 pt-px text-right font-mono text-[11px]">
        +{duration(offset)}
      </span>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-ash min-w-0 flex-1 text-[13px] break-all">{text}</span>
      {tail ? <span className="text-dim shrink-0 font-mono text-[11.5px]">{tail}</span> : null}
    </li>
  )
}

function Visit({ session }: { session: VisitorSessionRow }) {
  return (
    <li className="bg-carbon rounded-md border border-white/[0.09] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-bone text-[14px] font-semibold">{when(session.startedAt)}</span>
        <span className="text-dim font-mono text-[11.5px]">
          {session.pageviews} {session.pageviews === 1 ? "page" : "pages"} ·{" "}
          {duration(session.engagedSeconds)} · {sourceLine(session)}
          {placeLine(session) !== "-" ? ` · ${placeLine(session)}` : ""}
          {session.ip ? ` · ${session.ip}` : ""}
        </span>
      </div>
      {session.events.length ? (
        <ol className="border-t border-white/[0.06] pt-2">
          {session.events.map((e) => (
            <EventLine key={e.id} event={e} start={session.startedAt} />
          ))}
        </ol>
      ) : (
        <p className="text-dim text-[12.5px]">No pages recorded.</p>
      )}
    </li>
  )
}

function Body({ v }: { v: VisitorDetail }) {
  const name = visitorName(v)
  const first = v.name?.split(" ")[0] || "there"
  const cartText = v.cart?.items.map((i) => `${i.qty} × ${i.name} (${i.colourway})`).join(", ")

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title={name}
        parent={VISITORS}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {v.anonymous ? (
              <Badge variant="muted">Anonymous - did not accept cookies</Badge>
            ) : (
              <Badge variant="acid">
                Accepted cookies{v.consentAt ? ` · ${when(v.consentAt)}` : ""}
              </Badge>
            )}
            {v.customer ? (
              <Link href={`/admin/customers/${v.customer.id}`}>
                <Badge variant="ember">Buyer · see orders</Badge>
              </Link>
            ) : null}
            {v.email ? <span className="text-ash font-mono text-[12.5px]">{v.email}</span> : null}
            {v.phone ? <span className="text-ash font-mono text-[12.5px]">{v.phone}</span> : null}
          </span>
        }
        actions={
          <ContactActions
            phone={v.phone}
            email={v.email}
            subject="From SKELMET"
            message={
              cartText
                ? `Hi ${first}, this is SKELMET. You left ${cartText} in your cart. Want a hand finishing your order?`
                : `Hi ${first}, this is SKELMET.`
            }
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Visits">{v.visitCount}</StatTile>
        <StatTile label="Pages viewed">{v.pageviews}</StatTile>
        <StatTile label="Time on site">{duration(v.engagedSeconds)}</StatTile>
        <StatTile label="First seen">
          <span className="font-mono text-[14px]">{when(v.firstSeenAt)}</span>
        </StatTile>
        <StatTile label="Last seen">
          <span className="font-mono text-[14px]">{when(v.lastSeenAt)}</span>
        </StatTile>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title="Device"
          icon={<DeviceIcon type={v.deviceType} className="text-ember size-4" />}
        >
          <dl>
            <Fact label="Type" value={v.deviceType} />
            <Fact label="Model" value={v.deviceModel} />
            <Fact label="System" value={v.os} />
            <Fact label="Browser" value={v.browser} />
            <Fact label="Screen" value={v.screen} mono />
            <Fact label="Language" value={v.language} mono />
            <Fact label="Time zone" value={v.timezone} mono />
            <Fact label="User agent" value={v.userAgent} mono />
          </dl>
        </Card>

        <Card title="Where" icon={<MapPin className="text-ember size-4" strokeWidth={1.9} />}>
          <dl>
            <Fact label="City" value={v.city} />
            <Fact label="District" value={v.district} />
            <Fact label="State" value={v.region} />
            <Fact label="Region" value={regionOf(v.region)} />
            <Fact label="Country" value={v.country} mono />
            <Fact label="Postal area (from IP)" value={v.postalCode} mono />
            <Fact label="Pincode typed" value={v.pincode} mono />
            <Fact
              label="Map point (from IP)"
              value={
                v.latitude != null && v.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-acid hover:text-bone underline-offset-2 hover:underline"
                  >
                    {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                  </a>
                ) : null
              }
              mono
            />
            <Fact label="IP address" value={v.ip} mono />
          </dl>
          {v.anonymous ? (
            <p className="text-dim mt-3 text-[12px] leading-[1.5]">
              A visitor who did not accept cookies keeps their city, district and state, but no IP
              address or pincode.
            </p>
          ) : (
            <p className="text-dim mt-3 text-[12px] leading-[1.5]">
              Everything marked &quot;from IP&quot; is Cloudflare&apos;s estimate for the
              connection, often the network&apos;s hub rather than the street: a mobile in South
              Delhi can read as 110001. The pincode typed at checkout is the real one.
            </p>
          )}
        </Card>

        <Card
          title="First came from"
          icon={<Compass className="text-ember size-4" strokeWidth={1.9} />}
        >
          <dl>
            <Fact label="Source" value={sourceLine(v) === "-" ? null : sourceLine(v)} />
            <Fact label="Campaign" value={v.campaign} />
            <Fact label="Referrer" value={v.referrer} mono />
            <Fact label="Landed on" value={v.landingPage} mono />
          </dl>
        </Card>
      </div>

      {v.linked.length ? (
        <Card
          title="Probably the same person"
          icon={<Link2 className="text-ember size-4" strokeWidth={1.9} />}
        >
          <p className="text-dim mb-3 text-[12px] leading-[1.5]">
            Each browser keeps its own cookie, so the same phone in Chrome and in Brave arrives as
            two visitors. These share an email or phone typed at checkout, or the same connection
            and kind of device within a few hours. Only visitors who accepted cookies are matched.
          </p>
          <ul className="flex flex-col">
            {v.linked.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <Badge variant={l.reason === "contact" ? "acid" : "muted"}>
                    {l.reason === "contact" ? "Same person" : "Likely"}
                  </Badge>
                  <Link
                    href={`/admin/customers/visitors/${l.id}`}
                    className="text-bone hover:text-blaze text-[13.5px] font-medium transition-colors"
                  >
                    {visitorName({ ...l, anonymous: false })}
                  </Link>
                  <span className="text-dim text-[12.5px]">
                    {[l.deviceModel ?? l.os, l.browser].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-ash text-[12.5px]">
                  {l.because} · last seen {when(l.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {v.cart || v.orders.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {v.cart ? (
            <Card
              title="In their cart now"
              icon={<ShoppingCart className="text-ember size-4" strokeWidth={1.9} />}
            >
              <ul className="mb-3 flex flex-col gap-1.5">
                {v.cart.items.map((i) => (
                  <li key={i.sku} className="flex items-baseline justify-between gap-4">
                    <span className="text-bone text-[13.5px]">
                      {i.qty} × {i.name} <span className="text-dim">· {i.colourway}</span>
                    </span>
                    <Money
                      value={Number(i.unitPrice) * i.qty}
                      className="text-ash font-mono text-[13px]"
                    />
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-3">
                <span className="text-dim text-[12.5px]">
                  Changed {when(v.cart.updatedAt)}
                  {v.cart.checkoutAt ? ` · reached checkout ${when(v.cart.checkoutAt)}` : ""}
                </span>
                <Money value={v.cart.value} className="text-bone font-mono text-[14px]" />
              </div>
            </Card>
          ) : null}

          {v.orders.length ? (
            <Card
              title="Orders"
              icon={<ShoppingBag className="text-ember size-4" strokeWidth={1.9} />}
            >
              <ul className="flex flex-col gap-2">
                {v.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-bone hover:text-blaze font-mono text-[13px] transition-colors"
                    >
                      {o.number}
                    </Link>
                    {isOrderStatus(o.status) ? <StatusBadge status={o.status} /> : null}
                    <Money value={o.total} className="text-ash font-mono text-[13px]" />
                    <span className="text-dim font-mono text-[11.5px]">{when(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="text-bone mb-3 text-[15px] font-semibold">Visits, newest first</h2>
        {v.sessions.length ? (
          <ol className="flex flex-col gap-3">
            {v.sessions.map((s) => (
              <Visit key={s.id} session={s} />
            ))}
          </ol>
        ) : (
          <p className="text-dim text-[13.5px]">No visits recorded.</p>
        )}
      </div>
    </div>
  )
}

export function VisitorDetailView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useVisitor(id)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-7 w-64 animate-pulse rounded-md bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-white/5" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-md bg-white/5" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader icon={Users} title="Visitor" parent={VISITORS} />
        <EmptyState
          title="Could not load this visitor"
          description={error instanceof Error ? error.message : undefined}
        />
      </div>
    )
  }

  return <Body v={data} />
}
