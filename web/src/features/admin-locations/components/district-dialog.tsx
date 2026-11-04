import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminDistrict } from "@sayaratak/shared/schemas/admin"
import {
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { districtSchema, type DistrictForm } from "../schemas"
import { NameFields } from "./name-fields"

// Add or edit a district: its city and both names.
export function DistrictDialog({
  district,
  cityId,
  cityOptions,
  onClose,
}: {
  district: AdminDistrict | "new" | undefined
  // The city filter, preset for a new district.
  cityId?: string
  cityOptions: { value: string; label: string }[]
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateTaxonomyRow("districts")
  const update = useUpdateTaxonomyRow("districts")
  const form = useAppForm<DistrictForm>({
    resolver: zodResolver(districtSchema),
    mode: "onTouched",
  })
  const editing = district && district !== "new" ? district : undefined
  useEffect(() => {
    if (!district) return
    form.reset(
      editing
        ? {
            cityId: editing.cityId,
            nameAr: editing.name.ar,
            nameEn: editing.name.en,
          }
        : { cityId: cityId ?? "", nameAr: "", nameEn: "" }
    )
  }, [district, editing, cityId, form])
  const { errors } = form.formState
  return (
    <ResponsiveDialog
      open={!!district}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        editing
          ? "admin.locations_edit_district"
          : "admin.locations_add_district"
      )}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ cityId: city, nameAr, nameEn }) => {
          const body = { cityId: city, name: { ar: nameAr, en: nameEn } }
          const options = {
            onSuccess: () => {
              toast.add({ title: t("admin.locations_saved") })
              onClose()
            },
            onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
          }
          if (editing) update.mutate({ id: editing.id, ...body }, options)
          else create.mutate(body, options)
        })}
      >
        <FormField
          label={t("admin.locations_col_city")}
          error={errors.cityId?.message}
        >
          {(props) => (
            <Controller
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <SelectInput
                  {...props}
                  value={field.value}
                  onChange={field.onChange}
                  options={cityOptions}
                />
              )}
            />
          )}
        </FormField>
        <NameFields
          ar={form.register("nameAr")}
          en={form.register("nameEn")}
          errorAr={errors.nameAr?.message}
          errorEn={errors.nameEn?.message}
        />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={create.isPending || update.isPending}>
            {t("common.save")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
