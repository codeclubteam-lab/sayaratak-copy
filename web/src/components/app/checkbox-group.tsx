import { FieldLegend, FieldSet } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FieldError } from "./field-error"
import type { ChipOption } from "./chip-select"

// For contact methods and notification switches: plain checkboxes under one legend with an error slot.
export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  error,
  disabled = [],
  row = false,
  hideLegend,
}: {
  legend: string
  options: ChipOption[]
  value: string[]
  onChange: (value: string[]) => void
  error?: string
  // Values that stay visible but cannot be changed.
  disabled?: string[]
  // Lay the options in one wrapping line instead of a column.
  row?: boolean
  hideLegend?: boolean
}) {
  return (
    <FieldSet>
      <FieldLegend
        variant="label"
        className={hideLegend ? "sr-only" : undefined}
      >
        {legend}
      </FieldLegend>
      <div className={row ? "flex flex-wrap gap-x-6" : "contents"}>
        {options.map((o) => (
          <Label key={o.value} className="min-h-(--row-h) font-normal">
            <Checkbox
              checked={value.includes(o.value)}
              disabled={disabled.includes(o.value)}
              aria-invalid={Boolean(error)}
              onCheckedChange={(on) =>
                onChange(
                  on ? [...value, o.value] : value.filter((x) => x !== o.value)
                )
              }
            />
            {o.label}
          </Label>
        ))}
      </div>
      <FieldError message={error} />
    </FieldSet>
  )
}
