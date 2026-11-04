import type { ReactNode } from "react"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { useCityName } from "@/hooks/use-city-name"
import type { AdminVerification } from "@sayaratak/shared/schemas/admin"
import { MediaImage } from "@/components/app/media-image"
import { PhotoGrid } from "@/components/app/photo-grid"
import { StatusBadge } from "@/components/app/status-badge"

// The body of the verification sheet: the business and its owner, the owner's note, then the documents (a press opens the zoomable viewer).
export function VerificationDetails({
  request,
}: {
  request: AdminVerification
}) {
  const { t, locale } = useT()
  const { target, owner } = request
  const city = useCityName(target?.cityId ?? "")
  const fact = (label: string, value: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="truncate text-ui">{value}</dd>
    </div>
  )
  const documents = request.documents.map((d) => ({
    id: d.id,
    type: "image" as const,
    url: d.url,
    width: 0,
    height: 0,
    placeholderColor: "",
    posterUrl: null,
    caption: t(`verification.${d.label}_label`),
  }))
  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3">
        <MediaImage
          src={target?.imageUrl ?? null}
          alt=""
          sizes="64px"
          className="size-14 shrink-0 rounded-lg"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-body font-semibold">
            <bdi>
              {target?.name[locale] ?? t("admin.verification_target_gone")}
            </bdi>
          </p>
          <p className="text-caption text-muted-foreground">
            {t(`dashboard.role_${request.targetType}`)}
            {city && ` · ${city}`}
          </p>
        </div>
      </section>
      <dl className="grid grid-cols-2 gap-4">
        {fact(
          t("admin.report_col_status"),
          <StatusBadge status={request.status} />
        )}
        {fact(
          t("admin.verification_col_submitted"),
          formatDate(request.createdAt, locale)
        )}
        {fact(t("admin.verification_col_owner"), <bdi>{owner?.name}</bdi>)}
        {owner?.phone &&
          fact(
            t("admin.verification_phone"),
            <bdi dir="ltr">{owner.phone}</bdi>
          )}
        {owner?.email &&
          fact(
            t("admin.verification_email"),
            <bdi dir="ltr">{owner.email}</bdi>
          )}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {target && (
          <a
            href={localeHref(`/${request.targetType}s/${target.slug}`, locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ui font-medium text-primary hover:underline"
          >
            {t("admin.review_open_target")}
          </a>
        )}
        <a
          href={localeHref(`/admin/users?id=${request.ownerId}`, locale)}
          className="text-ui font-medium text-primary hover:underline"
        >
          {t("admin.open_user")}
        </a>
      </div>
      {request.rejectionReason && (
        <section className="flex flex-col gap-1">
          <h3 className="text-ui font-semibold">
            {t("admin.verification_rejection")}
          </h3>
          <p className="text-body whitespace-pre-line">
            {request.rejectionReason}
          </p>
        </section>
      )}
      <section className="flex flex-col gap-1">
        <h3 className="text-ui font-semibold">
          {t("admin.verification_note")}
        </h3>
        <p className="text-body whitespace-pre-line">
          {request.note ?? t("admin.report_no_note")}
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-ui font-semibold">
          {t("admin.verification_documents")}
        </h3>
        <PhotoGrid
          items={documents}
          alt={t("admin.verification_documents")}
          zoomable
        />
      </section>
    </div>
  )
}
