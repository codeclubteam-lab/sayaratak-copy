import { Controller, useFormContext } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { DatePicker } from "@/components/app/date-picker"
import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { placements, type BannerForm } from "../schemas"

// Title, link, placement (with its image size), the window, the focal point and the two switches.
export function BannerMainFields() {
  const { t } = useT()
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<BannerForm>()
  const placement = watch("placement")
  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("admin.banners_title")} error={errors.title?.message}>
        {(props) => <Input {...props} maxLength={80} {...register("title")} />}
      </FormField>
      <FormField
        label={t("admin.banners_href")}
        description={t("admin.banners_href_hint")}
        error={errors.href?.message}
      >
        {(props) => <Input {...props} dir="ltr" {...register("href")} />}
      </FormField>
      <Controller
        control={control}
        name="placement"
        render={({ field }) => (
          <FormField
            label={t("admin.banners_placement")}
            description={t(
              placement === "home_top"
                ? "admin.banners_size_hero"
                : "admin.banners_size_strip"
            )}
          >
            {(props) => (
              <SelectInput
                {...props}
                value={field.value}
                onChange={field.onChange}
                options={placements.map((p) => ({
                  value: p,
                  label: t(`admin.banners_placement_${p}`),
                }))}
              />
            )}
          </FormField>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {(["startsAt", "endsAt"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <FormField
                label={t(
                  name === "startsAt"
                    ? "admin.banners_starts"
                    : "admin.banners_ends"
                )}
                error={fieldState.error?.message}
              >
                {(props) => (
                  <DatePicker
                    {...props}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              </FormField>
            )}
          />
        ))}
      </div>
      <Controller
        control={control}
        name="focus"
        render={({ field }) => (
          <FormField
            label={t("admin.banners_focus")}
            description={t("admin.banners_focus_hint")}
          >
            {() => (
              <Slider
                aria-label={t("admin.banners_focus")}
                min={0}
                max={100}
                value={[field.value]}
                onValueChange={(v) =>
                  field.onChange(Array.isArray(v) ? v[0] : v)
                }
              />
            )}
          </FormField>
        )}
      />
      {(["sponsored", "active"] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <Label className="min-h-11 items-start gap-3 font-normal">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              <span className="flex flex-col">
                <span className="font-medium">
                  {t(`admin.banners_${name}`)}
                </span>
                <span className="text-caption text-muted-foreground">
                  {t(`admin.banners_${name}_hint`)}
                </span>
              </span>
            </Label>
          )}
        />
      ))}
    </div>
  )
}
