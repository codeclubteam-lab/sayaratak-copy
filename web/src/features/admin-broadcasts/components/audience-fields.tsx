import { useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { broadcastRoleSchema } from "@sayaratak/shared/schemas/api"
import { CheckboxGroup } from "@/components/app/checkbox-group"
import { CitySelect } from "@/components/app/city-select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { BroadcastForm } from "../schemas"

// Roles, an optional city and "Verified only". Individuals have no verification, so that switch unticks and locks Users.
export function AudienceFields({
  form,
}: {
  form: UseFormReturn<BroadcastForm>
}) {
  const { t } = useT()
  const id = useId()
  const { errors } = form.formState
  const verifiedOnly = form.watch("verifiedOnly")
  return (
    <div className="flex flex-col gap-4">
      <Controller
        control={form.control}
        name="roles"
        render={({ field }) => (
          <CheckboxGroup
            row
            legend={t("admin.broadcast_roles")}
            options={broadcastRoleSchema.options.map((r) => ({
              value: r,
              label: t(`admin.broadcast_role_${r}`),
            }))}
            value={field.value}
            onChange={field.onChange}
            disabled={verifiedOnly ? ["user"] : []}
            error={errors.roles?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="cityId"
        render={({ field }) => (
          <CitySelect
            optional
            label={t("admin.broadcast_city")}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="verifiedOnly"
        render={({ field }) => (
          <Label className="min-h-11 items-start gap-3 font-normal">
            <Switch
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-hint`}
              checked={field.value}
              onCheckedChange={(on) => {
                field.onChange(on)
                if (on)
                  form.setValue(
                    "roles",
                    form.getValues("roles").filter((r) => r !== "user"),
                    { shouldDirty: true }
                  )
              }}
            />
            <span className="flex flex-col gap-0.5">
              <span id={`${id}-label`} className="text-ui font-medium">
                {t("admin.broadcast_verified")}
              </span>
              <span
                id={`${id}-hint`}
                className="text-caption text-muted-foreground"
              >
                {t("admin.broadcast_verified_hint")}
              </span>
            </span>
          </Label>
        )}
      />
    </div>
  )
}
