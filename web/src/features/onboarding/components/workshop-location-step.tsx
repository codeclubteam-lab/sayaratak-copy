import { useFormContext } from "react-hook-form"

import type { WorkshopLocation } from "../schemas"
import { PhoneField } from "./phone-field"
import { PlaceFields } from "./place-fields"
import { WhatsappField } from "./whatsapp-field"

export function WorkshopLocationStep() {
  const { watch } = useFormContext<WorkshopLocation>()
  return (
    <>
      <PlaceFields />
      <PhoneField />
      <WhatsappField first={watch("phone")} />
    </>
  )
}
