import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { PlusIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PlanForm } from "../schemas"

const MAX_FEATURES = 8

// Up to eight lines the plan cards list, each in Arabic and English. A new line's Arabic field takes focus.
export function PlanFeaturesField({ form }: { form: UseFormReturn<PlanForm> }) {
  const { t } = useT()
  const rows = useFieldArray({ control: form.control, name: "features" })
  const errors = form.formState.errors.features
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-ui font-medium">
        {t("admin.plan_features")}{" "}
        <span className="font-normal text-muted-foreground">
          ({t("form.optional")})
        </span>
      </legend>
      <p className="text-caption text-muted-foreground">
        {t("admin.plan_features_hint", { max: MAX_FEATURES })}
      </p>
      <ol className="flex flex-col gap-3">
        {rows.fields.map((row, i) => (
          <li
            key={row.id}
            className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <FormField
              label={t("admin.plan_feature_ar", { n: i + 1 })}
              error={errors?.[i]?.ar?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  dir="rtl"
                  lang="ar"
                  maxLength={80}
                  {...form.register(`features.${i}.ar`)}
                />
              )}
            </FormField>
            <FormField
              label={t("admin.plan_feature_en", { n: i + 1 })}
              error={errors?.[i]?.en?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  dir="ltr"
                  lang="en"
                  maxLength={80}
                  {...form.register(`features.${i}.en`)}
                />
              )}
            </FormField>
            <RemoveButton
              variant="ghost"
              className="sm:mt-6"
              aria-label={t("admin.plan_feature_remove_label", { n: i + 1 })}
              title={t("admin.plan_feature_remove_title")}
              onConfirm={() => rows.remove(i)}
            >
              {t("common.remove")}
            </RemoveButton>
          </li>
        ))}
      </ol>
      {rows.fields.length < MAX_FEATURES && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              rows.append(
                { ar: "", en: "" },
                { focusName: `features.${rows.fields.length}.ar` }
              )
            }
          >
            <PlusIcon data-icon="inline-start" />
            {t("admin.plan_feature_add")}
          </Button>
        </div>
      )}
    </fieldset>
  )
}
