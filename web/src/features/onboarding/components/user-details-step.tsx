import { Controller, useFormContext } from "react-hook-form"

import { AvatarUpload } from "@/components/app/avatar-upload"
import { ChipMultiSelect } from "@/components/app/chip-multi-select"
import { CitySelect } from "@/components/app/city-select"
import { useT } from "@/lib/i18n/use-t"
import { interestSchema, type Interest } from "@sayaratak/shared/schemas/user"
import { mediaFromId } from "../media"
import type { UserOnboarding } from "../schemas"

const labelKeys = {
  cars: "nav.cars",
  trucks: "nav.trucks",
  motorcycles: "nav.motorcycles",
  tuk_tuks: "onboarding.interest_tuk_tuks",
  parts: "nav.parts",
  workshops: "nav.workshops",
  mechanics: "nav.mechanics",
} satisfies Record<Interest, string>

export function UserDetailsStep() {
  const { t } = useT()
  const { control } = useFormContext<UserOnboarding>()
  return (
    <>
      <Controller
        control={control}
        name="cityId"
        render={({ field, fieldState }) => (
          <CitySelect
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="avatarId"
        render={({ field }) => (
          <AvatarUpload
            label={t("onboarding.user_avatar_label")}
            value={field.value ? mediaFromId(field.value) : null}
            onChange={(media) => field.onChange(media?.id)}
          />
        )}
      />
      <Controller
        control={control}
        name="interests"
        render={({ field }) => (
          <ChipMultiSelect
            legend={`${t("onboarding.user_interests_legend")} (${t("form.optional")})`}
            options={interestSchema.options.map((value) => ({
              value,
              label: t(labelKeys[value]),
            }))}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  )
}
