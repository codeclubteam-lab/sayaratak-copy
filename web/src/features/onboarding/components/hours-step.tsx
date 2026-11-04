import { Controller, useFormContext } from "react-hook-form"

import { WeeklyHoursEditor } from "@/components/app/weekly-hours-editor"
import type { HoursStep as HoursValues } from "../schemas"

// Opening hours for a dealership, and for the workshop step that adds services next to it.
export function HoursStep() {
  const { control } = useFormContext<HoursValues>()
  return (
    <Controller
      control={control}
      name="hours"
      render={({ field, fieldState }) => (
        <WeeklyHoursEditor
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  )
}
