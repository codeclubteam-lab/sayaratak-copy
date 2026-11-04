import type { ReactNode } from "react"

import { CitySelect } from "@/components/app/city-select"
import { DatePicker } from "@/components/app/date-picker"
import { FormField, type ControlProps } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { SelectInput } from "@/components/app/select-input"
import { YesNoField } from "@/components/app/yes-no-field"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { labelKey, type FieldDef } from "./details-sections"
import { useStepFields } from "./use-step-fields"

const firstYear = 1970
// Local calendar day <-> "YYYY-MM-DD", so no time zone moves the date.
const toDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`) : undefined
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// One field of the details step, drawn from its definition. `optional` adds the "(Optional)" mark to the label.
export function DetailField({ def }: { def: FieldDef }) {
  const { t, locale } = useT()
  const { values, error, set } = useStepFields()
  const label = t(labelKey(def))
  const value = values[def.name]
  const options =
    typeof def.options === "function" ? def.options(values) : def.options
  const wrap = def.full ? "col-span-full" : undefined
  const field = (control: (c: ControlProps) => ReactNode) => (
    <FormField
      label={label}
      optional={!def.required}
      error={error(def.name)}
      description={def.hint && t(def.hint)}
      className={wrap}
    >
      {control}
    </FormField>
  )

  switch (def.kind) {
    case "yesno":
      return (
        <div className={wrap}>
          <YesNoField
            label={label}
            value={value ?? null}
            onChange={(v) => set(def.name, v)}
            error={error(def.name)}
          />
        </div>
      )
    case "city":
      return (
        <CitySelect
          label={label}
          optional={!def.required}
          value={value ?? ""}
          onChange={(id) => set(def.name, id)}
          error={error(def.name)}
        />
      )
    case "date":
      return field((c) => (
        <DatePicker
          {...c}
          placeholder={label}
          value={toDate(value ?? null)}
          onChange={(d) => set(def.name, d ? toIso(d) : null)}
        />
      ))
    case "int":
    case "number":
      return field((c) => (
        <div className="flex items-center gap-2">
          <NumberField
            {...c}
            grouping={def.kind === "int" && (def.max ?? 0) >= 100_000}
            min={def.min}
            max={def.max}
            step={def.step}
            value={value ?? null}
            onChange={(n) => set(def.name, n)}
          />
          {def.money && (
            <span className="text-caption text-muted-foreground">
              {formatPrice(0, locale).unit}
            </span>
          )}
        </div>
      ))
    case "text":
      return field((c) => (
        <Input
          {...c}
          dir={def.dir}
          value={value ?? ""}
          onChange={(e) => set(def.name, e.target.value || (def.blank ?? null))}
        />
      ))
    default: {
      const last = new Date().getFullYear() + 1
      const choices =
        def.kind === "year"
          ? Array.from({ length: last - firstYear + 1 }, (_, i) =>
              String(last - i)
            )
          : (options ?? [])
      const keyOf = def.keyOf ?? ((o: string) => o)
      return field((c) => (
        <SelectInput
          {...c}
          value={value == null ? "" : String(value)}
          placeholder={t("form.choose")}
          options={choices.map((o) => ({
            value: o,
            label: def.kind === "year" ? o : t(keyOf(o)),
          }))}
          onChange={(v) =>
            set(
              def.name,
              v ? (def.kind === "year" || def.numeric ? Number(v) : v) : null
            )
          }
        />
      ))
    }
  }
}
