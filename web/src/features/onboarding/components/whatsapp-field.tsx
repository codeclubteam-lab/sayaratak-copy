import { useEffect, useState } from "react"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useT } from "@/lib/i18n/use-t"

// An optional WhatsApp number. "Same as first phone" mirrors `first` until it is unticked.
export function WhatsappField({ first }: { first: string }) {
  const { t } = useT()
  const { control, setValue } = useFormContext<{ whatsapp: string }>()
  const whatsapp = useWatch({ control, name: "whatsapp" })
  // Until the box is touched, a number equal to the first phone counts as "same".
  const [choice, setChoice] = useState<boolean>()
  const same = choice ?? (whatsapp !== "" && whatsapp === first)
  useEffect(() => {
    if (same) setValue("whatsapp", first)
  }, [same, first, setValue])
  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={control}
        name="whatsapp"
        render={({ field, fieldState }) => (
          <FormField
            label={t("form.whatsapp")}
            error={fieldState.error?.message}
            optional
          >
            {(c) => (
              <PhoneInput
                {...c}
                disabled={same}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
        )}
      />
      <Label className="min-h-(--row-h) font-normal">
        <Checkbox checked={same} onCheckedChange={setChoice} />
        {t("form.same_as_phone")}
      </Label>
    </div>
  )
}
