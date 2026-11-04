import { ChipSelect, type ChipOption } from "./chip-select"

export function ChipMultiSelect({
  legend,
  options,
  value,
  onChange,
  max,
  error,
  hideLegend,
}: {
  legend: string
  options: ChipOption[]
  value: string[]
  onChange: (value: string[]) => void
  max?: number
  error?: string
  hideLegend?: boolean
}) {
  return (
    <ChipSelect
      type="checkbox"
      legend={legend}
      options={options}
      isOn={(v) => value.includes(v)}
      onToggle={(v) =>
        value.includes(v)
          ? onChange(value.filter((x) => x !== v))
          : max === undefined || value.length < max
            ? onChange([...value, v])
            : undefined
      }
      error={error}
      hideLegend={hideLegend}
    />
  )
}
