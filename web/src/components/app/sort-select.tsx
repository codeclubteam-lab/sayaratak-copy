import { useId } from "react"

import { useT } from "@/lib/i18n/use-t"
import { SelectInput } from "./select-input"

// Options come from the page: search pages pass the `sort` values of searchParamsSchema, favorites passes its own.
export function SortSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  const { t } = useT()
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-ui text-muted-foreground">
        {t("search.sort_label")}
      </label>
      <SelectInput
        id={id}
        className="w-auto"
        value={value}
        options={options.map((o) => ({
          value: o,
          label: t(`search.sort_${o}`),
        }))}
        onChange={(next) => {
          const found = options.find((o) => o === next)
          if (found) onChange(found)
        }}
      />
    </div>
  )
}
