import { Controller, useFormContext, useWatch } from "react-hook-form"

import { PhoneList, type PhoneRow } from "@/components/app/phone-list"
import { WhatsappField } from "@/features/onboarding/components/whatsapp-field"

type Contact = { phones: PhoneRow[]; whatsapp: string }

// One to three phones and an optional WhatsApp number that can follow the first phone.
export function ContactFields() {
  const { control, formState } = useFormContext<Contact>()
  const phones = useWatch({ control, name: "phones" })
  return (
    <>
      <Controller
        control={control}
        name="phones"
        render={({ field }) => (
          <PhoneList
            value={field.value}
            onChange={field.onChange}
            errors={field.value.map(
              (_, i) => formState.errors.phones?.[i]?.value?.message
            )}
          />
        )}
      />
      <WhatsappField first={phones[0]?.value ?? ""} />
    </>
  )
}
