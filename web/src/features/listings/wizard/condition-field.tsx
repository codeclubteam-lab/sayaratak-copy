import { ChipSingleSelect } from "@/components/app/chip-single-select"
import { useT } from "@/lib/i18n/use-t"
import { useStepFields } from "./use-step-fields"

// New or used. Choosing New empties the used-only fields (mileage, history), through the field rules.
export function ConditionField() {
  const { t } = useT()
  const { values, set } = useStepFields()
  return (
    <ChipSingleSelect
      legend={t("form.condition")}
      options={(["new", "used"] as const).map((c) => ({
        value: c,
        label: t(`condition.${c}`),
      }))}
      value={values.condition}
      onChange={(v) => set("condition", v)}
    />
  )
}
