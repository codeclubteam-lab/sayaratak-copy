import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { mediaSrc } from "@/lib/media"
import { useNow } from "@/lib/now"
import type { DataColumn } from "@/lib/table"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { bannerState } from "../schemas"
import { BannerActions } from "./banner-actions"
import { BannerStateBadge } from "./banner-state-badge"

// Thumbnail with title, placement, window, state, then views, clicks and click rate.
export function useBannerColumns(handlers: {
  onEdit: (b: Banner) => void
  onDuplicate: (b: Banner) => void
}): DataColumn<Banner>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "banner",
      header: t("admin.banners_col_banner"),
      enableHiding: false,
      cell: ({ row: { original: b } }) => (
        <span className="flex items-center gap-3">
          <img
            src={mediaSrc(b.imageUrl[locale], 320)}
            width={64}
            height={40}
            alt=""
            loading="lazy"
            className="h-10 w-16 shrink-0 rounded-lg bg-muted object-cover"
          />
          <span className="max-w-56 truncate font-medium">{b.title}</span>
        </span>
      ),
    },
    {
      id: "placement",
      header: t("admin.banners_col_placement"),
      cell: ({ row }) => t(`admin.banners_placement_${row.original.placement}`),
    },
    {
      id: "dates",
      header: t("admin.banners_col_dates"),
      cell: ({ row: { original: b } }) =>
        `${formatDate(b.startsAt, locale)} – ${formatDate(b.endsAt, locale)}`,
    },
    {
      id: "state",
      header: t("admin.banners_col_state"),
      cell: ({ row }) => (
        <BannerStateBadge state={bannerState(row.original, now)} />
      ),
    },
    {
      id: "views",
      header: t("admin.banners_col_views"),
      meta: { align: "end" } as const,
      cell: ({ row }) => formatNumber(row.original.impressions, locale),
    },
    {
      id: "clicks",
      header: t("admin.banners_col_clicks"),
      meta: { align: "end" } as const,
      cell: ({ row }) => formatNumber(row.original.clicks, locale),
    },
    {
      id: "rate",
      header: t("admin.banners_col_rate"),
      meta: { align: "end" } as const,
      cell: ({ row: { original: b } }) =>
        `${formatNumber(b.impressions ? Math.round((b.clicks / b.impressions) * 1000) / 10 : 0, locale)}%`,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("manager.col_actions")}</span>,
      enableHiding: false,
      meta: { align: "end" } as const,
      cell: ({ row }) => <BannerActions banner={row.original} {...handlers} />,
    },
  ]
}
