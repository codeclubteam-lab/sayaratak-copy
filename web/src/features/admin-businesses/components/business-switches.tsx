import { Switch } from "@/components/ui/switch"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import type { BusinessChange } from "./business-change"

// The Verified or Active switch of a row. It only asks: the page's dialog confirms (or takes the suspension reason) and saves.
export function BusinessSwitch({
  business,
  field,
  onAsk,
}: {
  business: AdminBusiness
  field: "verified" | "active"
  onAsk: (change: BusinessChange) => void
}) {
  const { t, locale } = useT()
  const on =
    field === "verified" ? business.verified : business.status === "active"
  const action =
    field === "verified"
      ? on
        ? "unverify"
        : "verify"
      : on
        ? "suspend"
        : "reactivate"
  return (
    <Switch
      checked={on}
      aria-label={t(`admin.business_switch_${field}`, {
        name: business.name[locale],
      })}
      onCheckedChange={() => onAsk({ business, action })}
    />
  )
}
