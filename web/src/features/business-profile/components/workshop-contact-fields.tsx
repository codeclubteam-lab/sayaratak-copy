import { useFormContext, useWatch } from "react-hook-form"

import { PhoneField } from "@/features/onboarding/components/phone-field"
import { WhatsappField } from "@/features/onboarding/components/whatsapp-field"

type Contact = { phone: string; whatsapp: string }

// The workshop's one phone and an optional WhatsApp number that can follow it.
export function WorkshopContactFields() {
  const { control } = useFormContext<Contact>()
  const phone = useWatch({ control, name: "phone" })
  return (
    <>
      <PhoneField />
      <WhatsappField first={phone} />
    </>
  )
}
