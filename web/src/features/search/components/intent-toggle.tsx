import { useT } from "@/lib/i18n/use-t"
import { intentSchema, type Intent } from "@sayaratak/shared/schemas/listing"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Buy or rent. Pressing the chosen one again shows both.
export function IntentToggle({
  value,
  onChange,
}: {
  value?: Intent
  onChange: (intent: Intent | undefined) => void
}) {
  const { t } = useT()
  return (
    <ToggleGroup
      aria-label={t("home.intent")}
      variant="outline"
      spacing={0}
      value={value ? [value] : []}
      onValueChange={(next) => onChange(intentSchema.safeParse(next[0]).data)}
    >
      <ToggleGroupItem value="sale">{t("home.buy")}</ToggleGroupItem>
      <ToggleGroupItem value="rent">{t("home.rent")}</ToggleGroupItem>
    </ToggleGroup>
  )
}
