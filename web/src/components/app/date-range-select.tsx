import { useId } from "react"

import { rangeSchema, type Range } from "@sayaratak/shared/schemas/api"
import { useT } from "@/lib/i18n/use-t"
import { SelectInput } from "./select-input"

const ranges = ["7d", "30d", "90d"] as const

// The route keeps the value in its search params (parse them with `rangeSchema`), so a range can be shared and survives reload.
export function DateRangeSelect({
  value,
  onChange,
}: {
  value: Range
  onChange: (value: Range) => void
}) {
  const { t } = useT()
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-ui text-muted-foreground">
        {t("dashboard.range_label")}
      </label>
      <SelectInput
        id={id}
        className="w-auto"
        value={value}
        options={ranges.map((r) => ({
          value: r,
          label: t(`dashboard.range_${r}`),
        }))}
        onChange={(next) => onChange(rangeSchema.parse(next))}
      />
    </div>
  )
}
