import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"

import { CheckboxGroup } from "@/components/app/checkbox-group"
import { FieldGrid } from "@/components/app/field-grid"
import { FilterSwitch } from "@/components/app/filter-switch"
import { FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useT } from "@/lib/i18n/use-t"
import { useStepFields } from "./use-step-fields"

// Phone, and the WhatsApp number: a copy of the phone until the person unchecks "same number". The box starts checked when the two numbers are equal or WhatsApp is empty, and is the person's choice after that.
export function PhoneFields() {
  const { t } = useT()
  const { getValues } = useFormContext()
  const { values, error, set } = useStepFields()
  const [same, setSame] = useState(() => {
    const v = getValues()
    return !v.whatsapp || v.whatsapp === v.phone
  })
  useEffect(() => {
    if (same && (values.whatsapp ?? null) !== (values.phone || null))
      set("whatsapp", values.phone || null)
  }, [same, values.phone, values.whatsapp])
  return (
    <FieldGrid>
      <div className="flex flex-col gap-2">
        <FormField label={t("form.phone")} error={error("phone")}>
          {(c) => (
            <PhoneInput
              {...c}
              value={values.phone ?? ""}
              onChange={(v) => set("phone", v)}
            />
          )}
        </FormField>
        <Label className="min-h-(--row-h) font-normal">
          <Checkbox checked={same} onCheckedChange={setSame} />
          {t("post.same_whatsapp")}
        </Label>
      </div>
      {!same && (
        <FormField label={t("form.whatsapp")} error={error("whatsapp")}>
          {(c) => (
            <PhoneInput
              {...c}
              value={values.whatsapp ?? ""}
              onChange={(v) => set("whatsapp", v || null)}
            />
          )}
        </FormField>
      )}
    </FieldGrid>
  )
}

// Contact methods and whether the phone number shows. With the number hidden, Call is removed and cannot be chosen, and one method always stays.
export function MethodFields() {
  const { t } = useT()
  const { values, error, set } = useStepFields()
  const methods: string[] = values.methods ?? []
  const showPhone: boolean = values.showPhone ?? true
  const toggle = (on: boolean) => {
    set("showPhone", on)
    if (on || !methods.includes("call")) return
    const rest = methods.filter((m) => m !== "call")
    set("methods", rest.length ? rest : ["chat"])
  }
  return (
    <>
      <CheckboxGroup
        legend={t("post.methods_legend")}
        options={[
          { value: "call", label: t("listing.call") },
          { value: "whatsapp", label: t("listing.whatsapp") },
          { value: "chat", label: t("listing.message") },
        ]}
        value={methods}
        disabled={showPhone ? [] : ["call"]}
        row
        onChange={(next) => set("methods", next)}
        error={error("methods")}
      />
      <div className="flex flex-col gap-1">
        <FilterSwitch
          label={t("post.show_phone")}
          checked={showPhone}
          onChange={toggle}
        />
        {!showPhone && (
          <p className="text-caption text-muted-foreground">
            {t("listing.whatsapp_shows_number")}
          </p>
        )}
      </div>
    </>
  )
}
