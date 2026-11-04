import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { businessQueries } from "@/features/directory/queries"
import { useT } from "@/lib/i18n/use-t"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import { verificationQuery } from "../queries"
import { RequirementsList } from "./requirements-list"
import { StatusCard, type VerificationStatus } from "./status-card"
import { VerificationForm } from "./verification-form"

// Where the business stands on verification and, when it can ask, the form. The business is the truth for "approved": a seeded verified business has no request, and an admin can switch the badge off later.
export function VerificationPage({ targetType }: { targetType: TargetType }) {
  const { t } = useT()
  const title = t("dashboard.nav_verification")
  usePageTitle(title)
  const business = useQuery(businessQueries.mine)
  const request = useQuery(verificationQuery)
  // The rejected request the owner chose to answer; a newer rejection shows its card again.
  const [retryId, setRetryId] = useState<string>()
  const failed = business.isError || request.isError
  const ready = business.data && request.data !== undefined
  const latest = request.data
  const status: VerificationStatus =
    latest?.status === "pending"
      ? "pending"
      : business.data?.verified
        ? "approved"
        : latest?.status === "rejected"
          ? "rejected"
          : "none"
  const answering = status === "rejected" && retryId === latest?.id
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={title} />
      {failed ? (
        <SectionError
          message={t("verification.load_error")}
          onRetry={() =>
            [business, request].forEach((q) => q.isError && void q.refetch())
          }
        />
      ) : !ready ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <StatusCard
            status={status}
            request={latest}
            onRetry={answering ? undefined : () => setRetryId(latest?.id)}
          />
          {(status === "none" || answering) && (
            <>
              <RequirementsList targetType={targetType} />
              <VerificationForm targetType={targetType} />
            </>
          )}
        </>
      )}
    </div>
  )
}
