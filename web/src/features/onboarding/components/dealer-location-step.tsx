import { Controller, useFormContext } from "react-hook-form"

import { PhoneList } from "@/components/app/phone-list"
import type { DealerLocation } from "../schemas"
import { PlaceFields } from "./place-fields"
import { WhatsappField } from "./whatsapp-field"

export function DealerLocationStep() {
  const { control, watch, formState } = useFormContext<DealerLocation>()
  const { errors } = formState
  return (
    <>
      <PlaceFields />
      <Controller
        control={control}
        name="phones"
        render={({ field }) => (
          <PhoneList
            value={field.value}
            onChange={field.onChange}
            errors={field.value.map(
              (_, i) => errors.phones?.[i]?.value?.message
            )}
          />
        )}
      />
      <WhatsappField first={watch("phones")[0]?.value ?? ""} />
    </>
  )
}
