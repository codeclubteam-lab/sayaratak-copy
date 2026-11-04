import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CircleCheckIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listingQueries } from "@/features/listings/queries"
import { useListingActions } from "@/features/listings-manager/use-listing-actions"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { attentionOf } from "../attention"
import { AttentionRow } from "./attention-row"

const SHOWN = 5

// Rejected listings, listings ending within a week, and listings reserved for two weeks; on the dealer overview (`withPending`) also listings waiting for review. The first five; the rest wait behind the link.
export function NeedsAttentionCard({
  withPending = false,
}: {
  withPending?: boolean
}) {
  const { t, locale } = useT()
  const now = useNow()
  const actions = useListingActions()
  const attention = useQuery(
    listingQueries.mine({ needsAttention: true, pageSize: SHOWN })
  )
  const pending = useQuery({
    ...listingQueries.mine({ tab: "pending", pageSize: SHOWN }),
    enabled: withPending,
  })
  const isPending = attention.isPending || (withPending && pending.isPending)
  const isError = attention.isError || pending.isError
  const refetch = () => {
    void attention.refetch()
    if (withPending) void pending.refetch()
  }
  const rows = [
    ...(attention.data?.items ?? []).flatMap((listing) => {
      const reason = attentionOf(listing, now)
      return reason ? [{ listing, reason }] : []
    }),
    ...(pending.data?.items ?? []).map((listing) => ({
      listing,
      reason: "pending" as const,
    })),
  ].slice(0, SHOWN)
  const total = (attention.data?.total ?? 0) + (pending.data?.total ?? 0)
  return (
    <section
      aria-labelledby="overview-attention"
      className="flex flex-col gap-2 rounded-xl bg-card p-5"
    >
      <h2 id="overview-attention" className="text-body font-semibold">
        {t("dashboard.overview_attention_title")}
      </h2>
      {isError ? (
        <SectionError
          message={t("dashboard.overview_attention_error")}
          onRetry={refetch}
        />
      ) : isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3 py-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          level={3}
          icon={CircleCheckIcon}
          title={t("dashboard.overview_attention_empty")}
          className="py-6"
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {rows.map(({ listing, reason }) => (
              <AttentionRow
                key={listing.id}
                listing={listing}
                reason={reason}
                actions={actions}
              />
            ))}
          </ul>
          {total > SHOWN && (
            <Link
              to={
                withPending
                  ? "/$locale/dealer/inventory"
                  : "/$locale/account/listings"
              }
              params={{ locale }}
              className={buttonVariants({ variant: "ghost" })}
            >
              {t("dashboard.overview_attention_more")}
            </Link>
          )}
        </>
      )}
    </section>
  )
}
