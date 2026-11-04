import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Broadcast } from "@sayaratak/shared/schemas/api"
import { BroadcastStatusBadge } from "./broadcast-status-badge"
import { useAudienceSummary } from "./use-audience-summary"

// One sent broadcast below md.
export function HistoryCard({ broadcast: b }: { broadcast: Broadcast }) {
  const { t, locale } = useT()
  const summary = useAudienceSummary()
  return (
    <article className="flex flex-col gap-1 border-b p-3 in-[li:last-child]:border-b-0">
      <span className="flex items-center justify-between gap-2">
        <span className="text-ui font-medium">{b.title[locale]}</span>
        <BroadcastStatusBadge status={b.status} />
      </span>
      <span className="text-caption text-muted-foreground">{summary(b)}</span>
      <span className="text-caption text-muted-foreground">
        {formatDate(b.createdAt, locale)} ·{" "}
        {t("admin.broadcast_recipients", {
          count: b.recipients,
          n: formatNumber(b.recipients, locale),
        })}
      </span>
    </article>
  )
}
