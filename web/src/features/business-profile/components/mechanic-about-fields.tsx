import { Controller, useFormContext, useWatch } from "react-hook-form"

import { AvatarUpload } from "@/components/app/avatar-upload"
import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { ProfilePreview } from "@/components/app/profile-preview"
import { mediaFromUrl } from "@/features/onboarding/media"
import { useT } from "@/lib/i18n/use-t"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import { DetailsFields } from "./details-fields"

type About = {
  photoUrl: string
  name: Bilingual
  yearsOfExperience: number
  bio: Bilingual
}

// Photo, name, years and bio, with the public profile header beside them that follows each change before it is saved.
export function MechanicAboutFields({ cityId }: { cityId: string }) {
  const { t, locale } = useT()
  const { control } = useFormContext<About>()
  const [photoUrl, name] = useWatch({ control, name: ["photoUrl", "name"] })
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Controller
          control={control}
          name="photoUrl"
          render={({ field }) => (
            <AvatarUpload
              label={t("onboarding.mechanic_photo_label")}
              value={field.value ? mediaFromUrl(field.value) : null}
              onChange={(media) => field.onChange(media?.url ?? "")}
            />
          )}
        />
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
      </div>
      <ProfilePreview
        variant="mechanic"
        name={name[locale] || name.ar}
        imageUrl={photoUrl}
        cityId={cityId}
      />
      <div className="flex flex-col gap-4 md:col-span-2">
        <DetailsFields person />
      </div>
    </div>
  )
}
