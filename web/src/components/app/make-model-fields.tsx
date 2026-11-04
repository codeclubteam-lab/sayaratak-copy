import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import type { VehicleType } from "@sayaratak/shared/schemas/listing"
import { Input } from "@/components/ui/input"
import { FormField } from "./form-field"
import { MakeLogo } from "./make-logo"
import { SelectInput } from "./select-input"

export type MakeModelValue = {
  makeId: string | null
  modelId: string | null
  makeOther: string | null
  modelOther: string | null
}

const OTHER = "__other"

// "Other" is a non-null free-text field next to a null id, so the value matches the listing input schema as it is.
export function MakeModelFields({
  value,
  onChange,
  vehicleType,
  makeError,
  modelError,
  search = false,
  alwaysModel = false,
  className = "grid gap-4 sm:grid-cols-2",
}: {
  value: MakeModelValue
  onChange: (value: MakeModelValue) => void
  vehicleType?: VehicleType | null
  makeError?: string
  modelError?: string
  // Search forms: no "Other", and the model select is always there, disabled until a make is picked.
  search?: boolean
  // Show the model field (disabled until a make is chosen) so a parent grid does not shift when it appears.
  alwaysModel?: boolean
  className?: string
}) {
  const { t, locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  const makes =
    data?.makes.filter(
      (m) => !vehicleType || m.vehicleTypes.includes(vehicleType)
    ) ?? []
  const models = data?.models.filter((m) => m.makeId === value.makeId) ?? []
  const makeIsOther = value.makeOther !== null
  const modelIsOther = value.modelOther !== null
  const text = (
    label: string,
    key: "makeOther" | "modelOther",
    error?: string
  ) => (
    <FormField label={label} error={error}>
      {(control) => (
        <Input
          {...control}
          dir="auto"
          value={value[key] ?? ""}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      )}
    </FormField>
  )
  return (
    <div className={className}>
      <FormField
        label={t("form.make")}
        error={makeIsOther ? undefined : makeError}
      >
        {(control) => (
          <SelectInput
            {...control}
            value={makeIsOther ? OTHER : (value.makeId ?? "")}
            placeholder={t("form.select_make")}
            options={[
              ...makes.map((m) => ({
                value: m.id,
                label: m.name[locale],
                icon: <MakeLogo id={m.id} name={m.name.en} />,
              })),
              ...(search
                ? []
                : [
                    {
                      value: OTHER,
                      label: t("form.other"),
                      icon: <MakeLogo name="…" />,
                    },
                  ]),
            ]}
            onChange={(v) =>
              onChange(
                v === OTHER
                  ? {
                      makeId: null,
                      modelId: null,
                      makeOther: "",
                      modelOther: "",
                    }
                  : {
                      makeId: v || null,
                      modelId: null,
                      makeOther: null,
                      modelOther: null,
                    }
              )
            }
          />
        )}
      </FormField>
      {makeIsOther && text(t("form.make_name"), "makeOther", makeError)}
      {makeIsOther && text(t("form.model_name"), "modelOther", modelError)}
      {(value.makeId || search || alwaysModel) && (
        <FormField
          label={t("form.model")}
          error={modelIsOther ? undefined : modelError}
        >
          {(control) => (
            <SelectInput
              {...control}
              disabled={!value.makeId}
              value={modelIsOther ? OTHER : (value.modelId ?? "")}
              placeholder={t("form.select_model")}
              options={[
                ...models.map((m) => ({ value: m.id, label: m.name[locale] })),
                ...(search ? [] : [{ value: OTHER, label: t("form.other") }]),
              ]}
              onChange={(v) =>
                onChange(
                  v === OTHER
                    ? { ...value, modelId: null, modelOther: "" }
                    : { ...value, modelId: v || null, modelOther: null }
                )
              }
            />
          )}
        </FormField>
      )}
      {value.makeId &&
        modelIsOther &&
        text(t("form.model_name"), "modelOther", modelError)}
    </div>
  )
}
