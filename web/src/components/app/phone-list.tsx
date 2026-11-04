import { PlusIcon, XIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { FormField } from "./form-field"
import { PhoneInput } from "./phone-input"

export type PhoneRow = { value: string }

// One to `max` numbers. Takes a value and `onChange` like the other blocks, so it works with RHF `Controller`. `errors[i]` is the i-th row's message key.
export function PhoneList({
  value,
  onChange,
  errors = [],
  max = 3,
}: {
  value: PhoneRow[]
  onChange: (value: PhoneRow[]) => void
  errors?: (string | undefined)[]
  max?: number
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-3">
      {value.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <FormField
            label={t("form.phone_number", { number: i + 1 })}
            error={errors[i]}
            className="flex-1"
          >
            {(control) => (
              <PhoneInput
                {...control}
                value={row.value}
                onChange={(next) =>
                  onChange(value.map((r, j) => (j === i ? { value: next } : r)))
                }
              />
            )}
          </FormField>
          {value.length > 1 && (
            <RemoveButton
              variant="ghost"
              size="icon"
              className="mt-6"
              aria-label={t("form.remove_phone", { number: i + 1 })}
              title={t("form.remove_phone_title", { number: i + 1 })}
              onConfirm={() => onChange(value.filter((_, j) => j !== i))}
            >
              <XIcon />
            </RemoveButton>
          )}
        </div>
      ))}
      {value.length < max && (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => onChange([...value, { value: "" }])}
        >
          <PlusIcon data-icon="inline-start" />
          {t("form.add_phone")}
        </Button>
      )}
    </div>
  )
}
