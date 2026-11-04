import { useQuery } from "@tanstack/react-query"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { BroadcastAudience } from "@sayaratak/shared/schemas/api"
import { adminQueries } from "@/features/admin/queries"

// How many bells the audience reaches now (accounts that turned announcements off are left out). Read aloud as it changes. A span, so it also fits inside the confirm text.
export function RecipientEstimate({
  audience,
}: {
  audience: BroadcastAudience
}) {
  const { t, locale } = useT()
  const none = audience.roles.length === 0
  const estimate = useQuery({
    ...adminQueries.broadcastEstimate(audience),
    enabled: !none,
  })
  const count = none ? 0 : estimate.data?.count
  return (
    <span aria-live="polite">
      {count === undefined
        ? estimate.isError
          ? t("admin.broadcast_estimate_error")
          : t("admin.broadcast_estimating")
        : t("admin.broadcast_estimate", {
            count,
            n: formatNumber(count, locale),
          })}
    </span>
  )
}
