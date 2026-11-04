import { useQueryClient } from "@tanstack/react-query"

import { toast } from "@/components/ui/toast"
import { listingQueries } from "@/features/listings/queries"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { downloadCsv } from "../export-csv"

// Every listing of the account (up to 500), one row each, as a file Excel opens.
export function useExportListings() {
  const { t } = useT()
  const qc = useQueryClient()
  return async () => {
    try {
      const { items } = await qc.fetchQuery({
        ...listingQueries.mine({ pageSize: 500 }),
        staleTime: 0,
      })
      downloadCsv("listings.csv", [
        [
          t("manager.csv_id"),
          t("manager.col_listing"),
          t("manager.col_price"),
          t("manager.col_status"),
          t("manager.col_review"),
          t("manager.col_views"),
          t("manager.col_favorites"),
          t("manager.metric_calls"),
          t("manager.metric_whatsapp"),
          t("manager.col_posted"),
          t("manager.col_expires"),
        ],
        ...items.map((l) => [
          l.id,
          l.title,
          l.price,
          t(`status.${l.status}`),
          t(`status.${l.moderation}`),
          l.stats.views,
          l.stats.favorites,
          l.stats.phoneClicks,
          l.stats.whatsappClicks,
          l.createdAt.slice(0, 10),
          l.expiresAt.slice(0, 10),
        ]),
      ])
    } catch (error) {
      toast.add({ title: errorText(t, error) })
    }
  }
}
