import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { Broadcast } from "@sayaratak/shared/schemas/api"
import { BroadcastStatusBadge } from "./broadcast-status-badge"
import { useAudienceSummary } from "./use-audience-summary"

// Sent, title, audience, status and recipients reached so far, newest first from the server.
export function useHistoryColumns(): DataColumn<Broadcast>[] {
  const { t, locale } = useT()
  const summary = useAudienceSummary()
  return [
    {
      id: "sent",
      header: t("admin.broadcast_col_sent"),
      cell: ({ row }) =>
        `${formatDate(row.original.createdAt, locale)} ${formatTime(row.original.createdAt, locale)}`,
    },
    {
      id: "title",
      header: t("admin.broadcast_col_title"),
      enableHiding: false,
      cell: ({ row }) => (
        <span className="flex max-w-80 flex-col">
          <span className="font-medium">{row.original.title[locale]}</span>
          <span className="truncate text-caption text-muted-foreground">
            {row.original.body[locale]}
          </span>
        </span>
      ),
    },
    {
      id: "audience",
      header: t("admin.broadcast_col_audience"),
      cell: ({ row }) => summary(row.original),
    },
    {
      id: "status",
      header: t("admin.broadcast_col_status"),
      cell: ({ row }) => <BroadcastStatusBadge status={row.original.status} />,
    },
    {
      id: "recipients",
      header: t("admin.broadcast_col_recipients"),
      meta: { align: "end" } as const,
      cell: ({ row }) => formatNumber(row.original.recipients, locale),
    },
  ]
}
