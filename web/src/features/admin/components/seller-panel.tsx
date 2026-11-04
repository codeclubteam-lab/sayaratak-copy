import { useQuery } from "@tanstack/react-query"

import { VerifiedBadge } from "@/components/app/verified-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMonthYear, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { adminQueries } from "../queries"

// Who posted a listing under review, with their track record. The counts read the totals of two one-row pages.
// `className` lets a host that is already a card (the reports sheet) drop the panel's own surface.
export function SellerPanel({
  owner,
  className,
}: {
  owner: Listing["owner"]
  className?: string
}) {
  const { t, locale } = useT()
  const count = (moderation: "approved" | "rejected") =>
    adminQueries.listings({ ownerId: owner.id, moderation, pageSize: 1 })
  const approved = useQuery(count("approved")).data?.total
  const rejected = useQuery(count("rejected")).data?.total
  const stat = (label: string, value: number | undefined) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-ui font-semibold num">
        {value === undefined ? (
          <Skeleton className="h-5 w-8" aria-hidden="true" />
        ) : (
          formatNumber(value, locale)
        )}
      </dd>
    </div>
  )
  return (
    <section
      aria-label={t("admin.seller")}
      className={cn("flex flex-col gap-3 rounded-xl bg-card p-4", className)}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-semibold">
          <bdi>{owner.name[locale]}</bdi>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          {owner.verified && <VerifiedBadge />}
          <span>
            {owner.type === "dealership"
              ? t("common.dealership")
              : t("listing.seller_private")}
          </span>
          <span>
            {t("listing.member_since", {
              date: formatMonthYear(owner.memberSince, locale),
            })}
          </span>
        </p>
      </div>
      <dl className="flex gap-6">
        {stat(t("admin.approved_listings"), approved)}
        {stat(t("admin.rejected_listings"), rejected)}
      </dl>
      <a
        href={localeHref(`/admin/users?id=${owner.id}`, locale)}
        className="text-ui font-medium text-primary hover:underline"
      >
        {t("admin.open_user")}
      </a>
    </section>
  )
}
