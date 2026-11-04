import { PromotionListing } from "@/features/billing/components/promotion-listing"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import { EndPromotionButton } from "./end-promotion-button"

// Listing, type, source, start, end and End now. Newest first from the server, so no column sorts.
export function useActivePromotionColumns(): DataColumn<MyPromotion>[] {
  const { t, locale } = useT()
  const date = (iso?: string) => (iso ? formatDate(iso, locale) : "—")
  return [
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
      id: "source",
      header: t("billing.promos_col_source"),
      cell: ({ row }) => t(`billing.promos_source_${row.original.source}`),
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
      id: "actions",
      header: t("admin.promos_col_actions"),
      enableHiding: false,
      cell: ({ row }) => <EndPromotionButton promotion={row.original} />,
    },
  ]
}
