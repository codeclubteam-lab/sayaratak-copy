import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { ApiError } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminCountry } from "@sayaratak/shared/schemas/admin"
import {
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { countrySchema, type CountryForm } from "../schemas"
import { NameFields } from "./name-fields"

const blank: CountryForm = {
  code: "",
  nameAr: "",
  nameEn: "",
  dialCode: "+",
  enabled: false,
}

// Add or edit a country. The code is set once (cities point to it); showing a country on the site is its row switch, which asks first, so only a new country picks it here.
export function CountryDialog({
  country,
  onClose,
}: {
  country: AdminCountry | "new" | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const create = useCreateTaxonomyRow("countries")
  const update = useUpdateTaxonomyRow("countries")
  const form = useAppForm<CountryForm>({
    resolver: zodResolver(countrySchema),
    mode: "onTouched",
    defaultValues: blank,
  })
  const editing = country && country !== "new" ? country : undefined
  useEffect(() => {
    if (!country) return
    form.reset(
      editing
        ? {
            code: editing.id.toUpperCase(),
            nameAr: editing.name.ar,
            nameEn: editing.name.en,
            dialCode: editing.dialCode,
            enabled: editing.enabled,
          }
        : blank
    )
  }, [country, editing, form])
  const { errors } = form.formState
  return (
    <ResponsiveDialog
      open={!!country}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        editing ? "admin.locations_edit_country" : "admin.locations_add_country"
      )}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(
          ({ code, nameAr, nameEn, dialCode, enabled }) => {
            const name = { ar: nameAr, en: nameEn }
            const options = {
              onSuccess: () => {
                toast.add({ title: t("admin.locations_saved") })
                onClose()
              },
              onError: (e: unknown) =>
                e instanceof ApiError && e.code === "exists"
                  ? form.setError("code", {
                      message: "validation.country_code_taken",
                    })
                  : toast.add({ title: errorText(t, e) }),
            }
            if (editing)
              update.mutate({ id: editing.id, name, dialCode }, options)
            else create.mutate({ code, name, dialCode, enabled }, options)
          }
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("admin.locations_col_code")}
            description={editing && t("admin.locations_code_locked")}
            error={errors.code?.message}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                maxLength={2}
                autoCapitalize="characters"
                readOnly={!!editing}
                {...form.register("code")}
              />
            )}
          </FormField>
          <FormField
            label={t("admin.locations_col_dial_code")}
            error={errors.dialCode?.message}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="tel"
                maxLength={5}
                {...form.register("dialCode")}
              />
            )}
          </FormField>
        </div>
        <NameFields
          ar={form.register("nameAr")}
          en={form.register("nameEn")}
          errorAr={errors.nameAr?.message}
          errorEn={errors.nameEn?.message}
        />
        {!editing && (
          <label className="flex items-center justify-between gap-4 text-ui">
            {t("admin.locations_show_on_site")}
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </label>
        )}
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
