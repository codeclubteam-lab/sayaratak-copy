import { Controller } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import type { Settings } from "@sayaratak/shared/schemas/admin"
import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { Switch } from "@/components/ui/switch"
import { listingSettingsSchema } from "../schemas"
import { SettingsCard } from "./settings-card"

export function ListingSettings({ settings }: { settings: Settings }) {
  const { t } = useT()
  return (
    <SettingsCard
      title={t("admin.settings_listings")}
      description={t("admin.settings_listings_hint")}
      schema={listingSettingsSchema}
      values={{
        autoApproveVerifiedDealers: settings.autoApproveVerifiedDealers,
        listingExpiryDays: settings.listingExpiryDays,
      }}
      toBody={(v) => v}
    >
      {({ control, formState: { errors } }) => (
        <>
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <span id="auto-approve" className="text-ui font-medium">
                {t("admin.settings_auto_approve")}
              </span>
              <span
                id="auto-approve-hint"
                className="text-caption text-muted-foreground"
              >
                {t("admin.settings_auto_approve_hint")}
              </span>
            </div>
            <Controller
              control={control}
              name="autoApproveVerifiedDealers"
              render={({ field }) => (
                <Switch
                  aria-labelledby="auto-approve"
                  aria-describedby="auto-approve-hint"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          <FormField
            label={t("admin.settings_expiry")}
            description={t("admin.settings_expiry_hint")}
            error={errors.listingExpiryDays?.message}
          >
            {(props) => (
              <Controller
                control={control}
                name="listingExpiryDays"
                render={({ field }) => (
                  <NumberField
                    {...props}
                    className="w-32"
                    min={7}
                    max={180}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </FormField>
        </>
      )}
    </SettingsCard>
  )
}
