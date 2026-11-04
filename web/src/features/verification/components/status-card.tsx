import { VerifiedBadge } from "@/components/app/verified-badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import {
  verificationLabels,
  type VerificationRequest,
} from "@sayaratak/shared/schemas/admin"

export type VerificationStatus = "none" | "pending" | "approved" | "rejected"

// Focus lands here after a request is sent, so the new state is read out.
export const verificationStatusId = "verification-status"

// Where the account stands. A rejected request offers "Submit again" while `onRetry` is set.
export function StatusCard({
  status,
  request,
  onRetry,
}: {
  status: VerificationStatus
  request?: VerificationRequest | null
  onRetry?: () => void
}) {
  const { t, locale } = useT()
  const names = (request?.documents ?? []).map(({ label }) =>
    (verificationLabels as readonly string[]).includes(label)
      ? t(`verification.${label}_label`)
      : label
  )
  return (
    <section
      aria-labelledby={verificationStatusId}
      className="flex flex-col items-start gap-3 rounded-xl bg-card p-5"
    >
      <h2
        id={verificationStatusId}
        tabIndex={-1}
        className="flex flex-wrap items-center gap-2 text-title font-semibold outline-none"
      >
        {t(`verification.${status}_title`)}
        {status === "approved" && <VerifiedBadge />}
      </h2>
      <p role="status" className="text-body text-muted-foreground">
        {status === "pending" && request
          ? t("verification.pending_body", {
              date: formatDate(request.createdAt, locale),
            })
          : status === "rejected"
            ? request?.rejectionReason && (
                <span dir="auto">
                  {t("verification.rejected_reason", {
                    reason: request.rejectionReason,
                  })}
                </span>
              )
            : t(`verification.${status}_body`)}
      </p>
      {status === "pending" && names.length > 0 && (
        <p className="text-ui text-muted-foreground">
          {t("verification.docs_sent", {
            list: new Intl.ListFormat(locale).format(names),
          })}
        </p>
      )}
      {status === "rejected" && onRetry && (
        <Button type="button" onClick={onRetry}>
          {t("verification.submit_again")}
        </Button>
      )}
    </section>
  )
}
