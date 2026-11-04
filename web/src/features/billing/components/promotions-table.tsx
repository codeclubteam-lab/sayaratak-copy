import { MegaphoneIcon } from "lucide-react"

import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { PriceText } from "@/components/app/price-text"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import type { PromotionsSearch } from "../schemas"
import { PromotionCard } from "./promotion-card"
import { PromotionListing } from "./promotion-listing"
import { PromotionStatus } from "./promotion-status"

// One tab of the dealer's promotions. The list is short, so it is never paged.
export function PromotionsTable({
  tab,
  rows,
  loading,
  error,
  onRetry,
}: {
  tab: PromotionsSearch["tab"]
  rows: MyPromotion[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const { t, locale } = useT()
  const date = (iso?: string) => (iso ? formatDate(iso, locale) : "—")
  const columns: DataColumn<MyPromotion>[] = [
    {
      id: "listing",
      header: t("billing.promos_col_listing"),
      enableHiding: false,
      cell: ({ row }) => <PromotionListing promotion={row.original} />,
    },
    {
      id: "type",
      header: t("billing.promos_col_type"),
      cell: ({ row }) => (
        <Badge variant="primary">
          {t(`promotion.name_${row.original.type}`)}
        </Badge>
      ),
    },
    {
      id: "starts",
      header: t("billing.promos_col_starts"),
      cell: ({ row }) => date(row.original.startsAt),
    },
    {
      id: "ends",
      header: t("billing.promos_col_ends"),
      cell: ({ row }) => date(row.original.endsAt),
    },
    {
      id: "source",
      header: t("billing.promos_col_source"),
      cell: ({ row }) => t(`billing.promos_source_${row.original.source}`),
    },
    {
      id: "amount",
      header: t("billing.col_amount"),
      cell: ({ row }) =>
        row.original.price > 0 ? (
          <PriceText price={row.original.price} size="table" />
        ) : (
          t("billing.promos_free")
        ),
    },
    {
      id: "status",
      header: t("billing.col_status"),
      cell: ({ row }) => <PromotionStatus promotion={row.original} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(p) => p.id}
      label={t(`billing.promos_tab_${tab}`)}
      loading={loading}
      error={error}
      onRetry={onRetry}
      mobileCard={(p) => <PromotionCard promotion={p} />}
      empty={
        <EmptyState
          icon={MegaphoneIcon}
          title={t(`billing.promos_empty_${tab}`)}
          level={3}
        />
      }
      page={1}
      pageCount={1}
      hrefFor={() => ""}
      // One page: the pagination never renders.
      onPageChange={() => {}}
    />
  )
}
