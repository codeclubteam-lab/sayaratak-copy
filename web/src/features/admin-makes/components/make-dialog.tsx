import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { vehicleTypeSchema } from "@sayaratak/shared/schemas/listing"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import {
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { NameFields } from "@/features/admin-locations/components/name-fields"
import { mediaFromUrl } from "@/features/onboarding/media"
import { LogoUpload } from "@/components/app/logo-upload"
import { CheckboxGroup } from "@/components/app/checkbox-group"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { makeSchema, type MakeForm } from "../schemas"

type Make = Taxonomy["makes"][number]

// Add or edit a make: both names and the vehicle types it builds. A new make gets its slug from the English name on the server.
export function MakeDialog({
  make,
  onClose,
}: {
  make: Make | "new" | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateTaxonomyRow("makes")
  const update = useUpdateTaxonomyRow("makes")
  const form = useAppForm<MakeForm>({
    resolver: zodResolver(makeSchema),
    mode: "onTouched",
    defaultValues: { nameAr: "", nameEn: "", logoUrl: "", vehicleTypes: [] },
  })
  const editing = make && make !== "new" ? make : undefined
  useEffect(() => {
    if (make)
      form.reset({
        nameAr: editing?.name.ar ?? "",
        nameEn: editing?.name.en ?? "",
        logoUrl: editing?.logoUrl ?? "",
        vehicleTypes: editing?.vehicleTypes ?? [],
      })
  }, [make, editing, form])
  const { errors } = form.formState
  return (
    <ResponsiveDialog
      open={!!make}
      onOpenChange={(open) => !open && onClose()}
      title={t(editing ? "admin.makes_edit" : "admin.makes_add")}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(
          ({ nameAr, nameEn, logoUrl, vehicleTypes }) => {
            const body = {
              name: { ar: nameAr, en: nameEn },
              logoUrl: logoUrl || null,
              vehicleTypes,
            }
            const options = {
              onSuccess: () => {
                toast.add({ title: t("admin.makes_saved") })
                onClose()
              },
              onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
            }
            if (editing) update.mutate({ id: editing.id, ...body }, options)
            else create.mutate(body, options)
          }
        )}
      >
        <NameFields
          ar={form.register("nameAr")}
          en={form.register("nameEn")}
          errorAr={errors.nameAr?.message}
          errorEn={errors.nameEn?.message}
        />
        <Controller
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <LogoUpload
              label={t("admin.makes_logo")}
              value={field.value ? mediaFromUrl(field.value) : null}
              onChange={(media) => field.onChange(media?.url ?? "")}
            />
          )}
        />
        <Controller
          control={form.control}
          name="vehicleTypes"
          render={({ field }) => (
            <CheckboxGroup
              row
              legend={t("admin.makes_types")}
              options={vehicleTypeSchema.options.map((v) => ({
                value: v,
                label: t(`post.type_${v}`),
              }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.vehicleTypes?.message}
            />
          )}
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
