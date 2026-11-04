import { useT } from "@/lib/i18n/use-t"
import { Badge } from "@/components/ui/badge"
import type { BannerState } from "../schemas"

const variants = {
  live: "success",
  scheduled: "warning",
  ended: "muted",
  off: "muted",
} as const

export function BannerStateBadge({ state }: { state: BannerState }) {
  const { t } = useT()
  return (
    <Badge variant={variants[state]}>{t(`admin.banners_state_${state}`)}</Badge>
  )
}
