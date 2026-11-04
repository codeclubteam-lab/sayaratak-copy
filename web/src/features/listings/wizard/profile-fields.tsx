import { CitySelect } from "@/components/app/city-select"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n/use-t"
import { useStepFields } from "./use-step-fields"

// A new account has no name and city on record yet; the review asks for them here instead of sending the person through onboarding. The values live in the wizard form, so the review step validates them like any other field.
export function ProfileFields() {
  const { t } = useT()
  const { values, error, set } = useStepFields()
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-ui font-medium">{t("post.profile_title")}</h2>
        <p className="text-caption text-muted-foreground">
          {t("post.profile_helper")}
        </p>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          label={t("auth.full_name_label")}
          error={error("profileName")}
        >
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              value={values.profileName ?? ""}
              onChange={(e) => set("profileName", e.target.value)}
            />
          )}
        </FormField>
        <CitySelect
          value={values.profileCityId ?? ""}
          onChange={(id) => set("profileCityId", id)}
          error={error("profileCityId")}
        />
      </div>
    </section>
  )
}
