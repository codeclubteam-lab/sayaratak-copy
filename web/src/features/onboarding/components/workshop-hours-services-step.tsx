import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext } from "react-hook-form"

import { ServicePicker } from "@/components/app/service-picker"
import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import type { WorkshopHoursServices } from "../schemas"
import { HoursStep } from "./hours-step"

export function WorkshopHoursServicesStep() {
  const { locale } = useT()
  const { control, formState } = useFormContext<WorkshopHoursServices>()
  const templates = useQuery(taxonomyQuery).data?.serviceTemplates ?? []
  return (
    <>
      <HoursStep />
      <Controller
        control={control}
        name="services"
        render={({ field }) => (
          <ServicePicker
            value={field.value}
            onChange={field.onChange}
            templates={templates.map((s) => ({
              id: s.id,
              name: s.name[locale],
            }))}
            errors={field.value.map((_, i) => {
              const e = formState.errors.services?.[i]
              return {
                name: e?.name?.message,
                priceFrom: e?.priceFrom?.message,
              }
            })}
            error={formState.errors.services?.message}
          />
        )}
      />
    </>
  )
}
