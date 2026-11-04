import { Controller, useFormContext } from "react-hook-form"

import { ChipSingleSelect } from "@/components/app/chip-single-select"
import { DatePicker } from "@/components/app/date-picker"
import { FormField } from "@/components/app/form-field"
import { useT } from "@/lib/i18n/use-t"
import type { CampaignForm } from "../schemas"

export const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromDay = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Step 2: the first day and 1 to 4 weeks. Free slots on the next step follow these dates.
export function DatesStep() {
  const { t } = useT()
  const { control } = useFormContext<CampaignForm>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={control}
        name="startDate"
        render={({ field, fieldState }) => (
          <FormField
            label={t("ads.start_label")}
            error={fieldState.error?.message}
          >
            {(c) => (
              <DatePicker
                {...c}
                value={field.value ? fromDay(field.value) : undefined}
                onChange={(d) => field.onChange(d ? toDay(d) : "")}
                disabled={{ before: today }}
              />
            )}
          </FormField>
        )}
      />
      <Controller
        control={control}
        name="weeks"
        render={({ field }) => (
          <ChipSingleSelect
            legend={t("ads.weeks_label")}
            options={[1, 2, 3, 4].map((n) => ({
              value: String(n),
              label: t("ads.weeks", { count: n }),
            }))}
            value={String(field.value)}
            onChange={(v) => field.onChange(Number(v))}
          />
        )}
      />
    </div>
  )
}
