import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { defaultCenter } from "@/lib/map"
import type { AdminCity } from "@sayaratak/shared/schemas/admin"
import {
  adminQueries,
  useCreateTaxonomyRow,
  useUpdateTaxonomyRow,
} from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { MapCanvas } from "@/components/app/map-canvas"
import { NumberField } from "@/components/app/number-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { citySchema, type CityForm } from "../schemas"
import { NameFields } from "./name-fields"

// Add or edit a city: country, both names and the map center, typed or picked on the map. The slug is made once by the server from the English name.
export function CityDialog({
  city,
  countryId,
  onClose,
}: {
  city: AdminCity | "new" | undefined
  // The country filter, preset for a new city.
  countryId?: string
  onClose: () => void
}) {
  const { t, locale } = useT()
  const countries = useQuery(adminQueries.countries)
  const create = useCreateTaxonomyRow("cities")
  const update = useUpdateTaxonomyRow("cities")
  const form = useAppForm<CityForm>({
    resolver: zodResolver(citySchema),
    mode: "onTouched",
  })
  const editing = city && city !== "new" ? city : undefined
  useEffect(() => {
    if (!city) return
    form.reset(
      editing
        ? {
            countryId: editing.countryId,
            nameAr: editing.name.ar,
            nameEn: editing.name.en,
            ...editing.center,
          }
        : {
            countryId: countryId ?? "sd",
            nameAr: "",
            nameEn: "",
            ...defaultCenter,
          }
    )
  }, [city, editing, countryId, form])
  const { errors } = form.formState
  const [lat, lng] = form.watch(["lat", "lng"])
  const set = { shouldDirty: true, shouldValidate: true }
  return (
    <ResponsiveDialog
      open={!!city}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        editing ? "admin.locations_edit_city" : "admin.locations_add_city"
      )}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(
          ({ countryId: country, nameAr, nameEn, lat: y, lng: x }) => {
            const body = {
              countryId: country,
              name: { ar: nameAr, en: nameEn },
              center: { lat: y, lng: x },
            }
            const options = {
              onSuccess: () => {
                toast.add({ title: t("admin.locations_saved") })
                onClose()
              },
              onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
            }
            if (editing) update.mutate({ id: editing.id, ...body }, options)
            else create.mutate(body, options)
          }
        )}
      >
        <FormField
          label={t("admin.locations_col_country")}
          error={errors.countryId?.message}
        >
          {(props) => (
            <Controller
              control={form.control}
              name="countryId"
              render={({ field }) => (
                <SelectInput
                  {...props}
                  value={field.value}
                  onChange={field.onChange}
                  options={(countries.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.name[locale],
                  }))}
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
        <div className="grid grid-cols-2 gap-4">
          {(["lat", "lng"] as const).map((key) => (
            <FormField
              key={key}
              label={t(`admin.locations_${key}`)}
              error={errors[key]?.message}
            >
              {(props) => (
                <Controller
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <NumberField
                      {...props}
                      dir="ltr"
                      step={0.0001}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </FormField>
          ))}
        </div>
        <MapCanvas
          label={t("admin.locations_map_label")}
          center={{
            lat: lat || defaultCenter.lat,
            lng: lng || defaultCenter.lng,
          }}
          zoom={editing ? 11 : 6}
          pin={lat && lng ? { lat, lng } : null}
          onPick={(p) => {
            form.setValue("lat", Number(p.lat.toFixed(4)), set)
            form.setValue("lng", Number(p.lng.toFixed(4)), set)
          }}
          className="h-56"
        />
        <p className="text-caption text-muted-foreground">
          {t("admin.locations_map_hint")}
        </p>
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
