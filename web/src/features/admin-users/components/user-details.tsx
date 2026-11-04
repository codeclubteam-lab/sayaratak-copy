import type { ReactNode } from "react"

import { formatDate, formatNumber, initials } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { useCityName } from "@/hooks/use-city-name"
import type { AdminUser } from "@sayaratak/shared/schemas/admin"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { UserPayments } from "./user-payments"
import { UserStatusBadge } from "./user-status-badge"

// The body of the user sheet: who they are, how to reach them, the ban if any, their listings and reports, then payments.
export function UserDetails({ user }: { user: AdminUser }) {
  const { t, locale } = useT()
  const city = useCityName(user.cityId ?? "")
  const fact = (label: string, value: ReactNode) => (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="max-w-full truncate text-ui">{value}</dd>
    </div>
  )
  const verified = (yes: boolean) =>
    t(yes ? "admin.user_verified" : "admin.user_unverified")
  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3">
        <Avatar className="size-14 shrink-0">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-accent text-ui font-semibold text-accent-foreground">
            <bdi>{initials(user.fullName)}</bdi>
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-body font-semibold">
            <bdi>{user.fullName}</bdi>
          </p>
          <p className="text-caption text-muted-foreground">
            {t(`dashboard.role_${user.role}`)}
            {city && ` · ${city}`}
          </p>
        </div>
      </section>
      <dl className="grid grid-cols-2 gap-4">
        {fact(t("admin.report_col_status"), <UserStatusBadge user={user} />)}
        {fact(t("admin.user_col_joined"), formatDate(user.createdAt, locale))}
        {fact(
          t("admin.verification_phone"),
          user.phone ? (
            <>
              <bdi dir="ltr">{user.phone}</bdi>
              <span className="block text-caption text-muted-foreground">
                {verified(user.verifiedPhone)}
              </span>
            </>
          ) : (
            t("admin.user_none")
          )
        )}
        {fact(
          t("admin.verification_email"),
          user.email ? (
            <>
              <bdi dir="ltr">{user.email}</bdi>
              <span className="block text-caption text-muted-foreground">
                {verified(user.verifiedEmail)}
              </span>
            </>
          ) : (
            t("admin.user_none")
          )
        )}
        {fact(
          t("admin.user_col_listings"),
          <span className="num">{formatNumber(user.listings, locale)}</span>
        )}
        {fact(
          t("admin.user_reports_against"),
          <span className="num">
            {formatNumber(user.reportsAgainst, locale)}
          </span>
        )}
      </dl>
      {user.banned && user.bannedReason && (
        <p className="text-ui">
          {t("admin.user_ban_reason", { reason: user.bannedReason })}
        </p>
      )}
      {user.listings > 0 && (
        <a
          href={localeHref(`/admin/listings?ownerId=${user.id}`, locale)}
          className="self-start text-ui font-medium text-primary hover:underline"
        >
          {t("admin.user_view_listings")}
        </a>
      )}
      <UserPayments userId={user.id} />
    </div>
  )
}
