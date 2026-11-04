import type { ReactNode } from "react"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { useCityName } from "@/hooks/use-city-name"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { MediaImage } from "@/components/app/media-image"
import { RatingSummary } from "@/components/app/rating-summary"
import { Badge } from "@/components/ui/badge"
import { BusinessPlan } from "./business-plan"
import { BusinessStatusBadge } from "./business-status-badge"

// The body of the business sheet: who it is, its state, contact and owner, links to its public page and its owner, then the plan.
export function BusinessDetails({ business }: { business: AdminBusiness }) {
  const { t, locale } = useT()
  const city = useCityName(business.cityId)
  const fact = (label: string, value: ReactNode) => (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="max-w-full truncate text-ui">{value}</dd>
    </div>
  )
  const link = "self-start text-ui font-medium text-primary hover:underline"
  const { owner } = business
  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3">
        <MediaImage
          src={business.imageUrl || null}
          alt=""
          sizes="56px"
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-body font-semibold">
            <bdi>{business.name[locale]}</bdi>
          </p>
          <p className="text-caption text-muted-foreground">
            {t(`admin.business_type_${business.type}`)}
            {city && ` · ${city}`}
          </p>
        </div>
      </section>
      <dl className="grid grid-cols-2 gap-4">
        {fact(
          t("admin.report_col_status"),
          <BusinessStatusBadge business={business} />
        )}
        {fact(
          t("admin.business_col_verified"),
          business.verified ? (
            <Badge variant="success">{t("admin.business_verified_yes")}</Badge>
          ) : (
            <Badge variant="muted">{t("admin.business_verified_no")}</Badge>
          )
        )}
        {fact(
          t("admin.business_col_rating"),
          <RatingSummary
            avg={business.rating.avg}
            count={business.rating.count}
          />
        )}
        {fact(
          t("admin.business_col_created"),
          formatDate(business.createdAt, locale)
        )}
        {fact(
          t("admin.verification_phone"),
          business.phone ? (
            <bdi dir="ltr">{business.phone}</bdi>
          ) : (
            t("admin.user_none")
          )
        )}
        {fact(
          t("admin.business_whatsapp"),
          business.whatsapp ? (
            <bdi dir="ltr">{business.whatsapp}</bdi>
          ) : (
            t("admin.user_none")
          )
        )}
        {fact(
          t("admin.business_col_owner"),
          owner ? (
            <>
              <bdi>{owner.name}</bdi>
              {(owner.phone ?? owner.email) && (
                <bdi
                  dir="ltr"
                  className="block truncate text-caption text-muted-foreground"
                >
                  {owner.phone ?? owner.email}
                </bdi>
              )}
            </>
          ) : (
            t("admin.user_none")
          )
        )}
      </dl>
      {business.status === "suspended" && business.suspendedReason && (
        <p className="text-ui">
          {t("admin.business_suspend_reason_shown", {
            reason: business.suspendedReason,
          })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {business.status === "active" && (
          <a
            href={localeHref(`/${business.type}s/${business.slug}`, locale)}
            target="_blank"
            rel="noopener noreferrer"
            className={link}
          >
            {t("admin.business_public_page")}
          </a>
        )}
        <a
          href={localeHref(`/admin/users?id=${business.ownerId}`, locale)}
          className={link}
        >
          {t("admin.business_owner_link")}
        </a>
      </div>
      <BusinessPlan business={business} />
    </div>
  )
}
