import { Controller } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import type { Settings } from "@sayaratak/shared/schemas/admin"
import { FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { Input } from "@/components/ui/input"
import { contactSettingsSchema } from "../schemas"
import { SettingsCard } from "./settings-card"

export function ContactSettings({ settings }: { settings: Settings }) {
  const { t } = useT()
  return (
    <SettingsCard
      title={t("admin.settings_contact")}
      description={t("admin.settings_contact_hint")}
      schema={contactSettingsSchema}
      values={settings.contact}
      toBody={(contact) => ({
        contact: {
          ...contact,
          address: contact.address ?? "",
        },
      })}
    >
      {({ control, register, formState: { errors } }) => (
        <>
          <FormField
            label={t("admin.settings_phone")}
            error={errors.phone?.message}
          >
            {(props) => (
              <Controller
                control={control}
                name="phone"
                render={({ field }) => <PhoneInput {...props} {...field} />}
              />
            )}
          </FormField>
          <FormField
            label={t("admin.settings_whatsapp")}
            error={errors.whatsapp?.message}
            optional
          >
            {(props) => (
              <Controller
                control={control}
                name="whatsapp"
                render={({ field }) => <PhoneInput {...props} {...field} />}
              />
            )}
          </FormField>
          <FormField
            label={t("admin.settings_email")}
            error={errors.email?.message}
          >
            {(props) => (
              <Input {...props} dir="ltr" type="email" {...register("email")} />
            )}
          </FormField>
          <FormField
            label={t("admin.settings_address")}
            error={errors.address?.message}
            optional
          >
            {(props) => (
              <Input {...props} maxLength={200} {...register("address")} />
            )}
          </FormField>
        </>
      )}
    </SettingsCard>
  )
}
