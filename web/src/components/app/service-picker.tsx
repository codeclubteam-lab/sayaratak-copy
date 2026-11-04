import { PlusIcon, XIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { Input } from "@/components/ui/input"
import { ChipMultiSelect } from "./chip-multi-select"
import { FormField } from "./form-field"
import { NumberField } from "./number-field"

export type ServiceRow = {
  name: string
  priceFrom: number | null
  templateId: string | null
}
type RowError = { name?: string; priceFrom?: string } | undefined

// A template chip adds or removes the row that carries its `templateId`; editing a row's name keeps the id, so the chip stays ticked and a language switch changes nothing. Custom rows have a null id. Takes a value and `onChange` like the other blocks, so it works with RHF `Controller`.
export function ServicePicker({
  value,
  onChange,
  templates,
  errors = [],
  error,
  max = 10,
}: {
  value: ServiceRow[]
  onChange: (value: ServiceRow[]) => void
  templates: { id: string; name: string }[]
  errors?: RowError[]
  error?: string
  max?: number
}) {
  const { t } = useT()
  const patch = (i: number, p: Partial<ServiceRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const ticked = value.flatMap((r) => (r.templateId ? [r.templateId] : []))
  return (
    <div className="flex flex-col gap-4">
      <ChipMultiSelect
        legend={t("form.services")}
        options={templates.map((s) => ({ value: s.id, label: s.name }))}
        value={ticked}
        onChange={(ids) =>
          onChange([
            ...value.filter((r) => !r.templateId || ids.includes(r.templateId)),
            ...templates
              .filter((s) => ids.includes(s.id) && !ticked.includes(s.id))
              .map((s) => ({
                name: s.name,
                priceFrom: null,
                templateId: s.id,
              })),
          ])
        }
        max={max - (value.length - ticked.length)}
        error={error}
      />
      {value.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <FormField
            label={t("form.service_name", { number: i + 1 })}
            error={errors[i]?.name}
            className="flex-1"
          >
            {(c) => (
              <Input
                {...c}
                value={row.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
            )}
          </FormField>
          <FormField
            label={t("form.service_price")}
            error={errors[i]?.priceFrom}
            optional
            className="w-40"
          >
            {(c) => (
              <NumberField
                {...c}
                grouping
                value={row.priceFrom}
                onChange={(priceFrom) => patch(i, { priceFrom })}
              />
            )}
          </FormField>
          <RemoveButton
            variant="ghost"
            size="icon"
            className="mt-6"
            aria-label={t("form.remove_service", { number: i + 1 })}
            title={t("form.remove_service_title", { number: i + 1 })}
            onConfirm={() => onChange(value.filter((_, j) => j !== i))}
          >
            <XIcon />
          </RemoveButton>
        </div>
      ))}
      {value.length < max && (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() =>
            onChange([
              ...value,
              { name: "", priceFrom: null, templateId: null },
            ])
          }
        >
          <PlusIcon data-icon="inline-start" />
          {t("form.add_service")}
        </Button>
      )}
    </div>
  )
}
