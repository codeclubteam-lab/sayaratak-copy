import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminVerification } from "@sayaratak/shared/schemas/admin"
import { VerificationBusinessCell } from "./verification-business-cell"

// One request below md: the business button, then type, owner, when and how many documents.
export function VerificationCard({
  request,
  onOpen,
}: {
  request: AdminVerification
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <VerificationBusinessCell request={request} onOpen={onOpen} />
      <p className="text-caption">
        {t(`dashboard.role_${request.targetType}`)}
        {" · "}
        {t("admin.verification_docs", { count: request.documents.length })}
      </p>
      <p className="text-caption text-muted-foreground">
        <bdi>{request.owner?.name}</bdi>
        {" · "}
        {formatRelative(request.createdAt, now, locale)}
      </p>
    </article>
  )
}
