import { Controller, useFormContext } from "react-hook-form"

import { AvatarUpload } from "@/components/app/avatar-upload"
import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n/use-t"
import { mediaFromId } from "../media"
import type { MechanicAbout } from "../schemas"
import { DescriptionField } from "./description-field"
import { PhoneField } from "./phone-field"
import { WhatsappField } from "./whatsapp-field"

export function MechanicAboutStep() {
  const { t } = useT()
  const { control, register, formState, watch } =
    useFormContext<MechanicAbout>()
  return (
    <>
      <Controller
        control={control}
        name="photoId"
        render={({ field }) => (
          <AvatarUpload
            label={t("onboarding.mechanic_photo_label")}
            value={field.value ? mediaFromId(field.value) : null}
            onChange={(media) => field.onChange(media?.id)}
          />
        )}
      />
      <FormField
        label={t("auth.full_name_label")}
        error={formState.errors.name?.message}
      >
        {(c) => (
          <Input {...c} {...register("name")} size="lg" autoComplete="name" />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <PhoneField />
        <WhatsappField first={watch("phone")} />
      </div>
      <Controller
        control={control}
        name="yearsOfExperience"
        render={({ field, fieldState }) => (
          <FormField
            label={t("onboarding.mechanic_years_label")}
            error={fieldState.error?.message}
          >
            {(c) => (
              <NumberField
                {...c}
                size="lg"
                min={0}
                max={60}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
        )}
      />
      <DescriptionField
        name="bio"
        max={600}
        label={t("onboarding.mechanic_bio_label")}
      />
    </>
  )
}
