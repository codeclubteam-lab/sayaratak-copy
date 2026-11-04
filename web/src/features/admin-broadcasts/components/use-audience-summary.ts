import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import type { BroadcastAudience } from "@sayaratak/shared/schemas/api"
import { taxonomyQuery } from "@/features/listings/queries"

// "Dealerships, Workshops · Khartoum · Verified only"; every role reads "Everyone".
export function useAudienceSummary() {
  const { t, locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  return (a: BroadcastAudience) =>
    [
      a.roles.length === 4
        ? t("admin.broadcast_everyone")
        : a.roles
            .map((r) => t(`admin.broadcast_role_${r}`))
            .join(locale === "ar" ? "، " : ", "),
      a.cityId && data?.cities.find((c) => c.id === a.cityId)?.name[locale],
      a.verifiedOnly && t("admin.broadcast_verified"),
    ]
      .filter(Boolean)
      .join(" · ")
}
