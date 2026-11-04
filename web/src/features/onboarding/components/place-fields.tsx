import { useFormContext } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { LocationPicker } from "@/components/app/location-picker"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n/use-t"
import type { DealerLocation } from "../schemas"

// City, district, map pin and street address, shared by the dealership and workshop location steps.
export function PlaceFields() {
  const { t } = useT()
  const { register, setValue, watch, formState } =
    useFormContext<DealerLocation>()
  const { errors, isSubmitted } = formState
  const set = { shouldValidate: isSubmitted, shouldDirty: true }
  return (
    <>
      <LocationPicker
        districtRequired
        value={{
          cityId: watch("cityId"),
          districtId: watch("districtId") || null,
          location: watch("location"),
        }}
        cityError={errors.cityId?.message}
        districtError={errors.districtId?.message}
        onChange={(place) => {
          setValue("cityId", place.cityId, set)
          setValue("districtId", place.districtId ?? "", set)
          setValue("location", place.location, set)
        }}
      />
      <FormField label={t("form.address")} error={errors.address?.message}>
        {(c) => (
          <Input
            {...c}
            {...register("address")}
            size="lg"
            autoComplete="street-address"
          />
        )}
      </FormField>
    </>
  )
}
