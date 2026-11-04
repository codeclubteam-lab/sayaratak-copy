import type { UseFormRegisterReturn } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"

// The Arabic and English names every location dialog asks for, side by side from sm up.
export function NameFields({
  ar,
  en,
  errorAr,
  errorEn,
}: {
  ar: UseFormRegisterReturn
  en: UseFormRegisterReturn
  errorAr?: string
  errorEn?: string
}) {
  const { t } = useT()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={t("admin.plan_name_ar")} error={errorAr}>
        {(props) => (
          <Input {...props} dir="rtl" lang="ar" maxLength={60} {...ar} />
        )}
      </FormField>
      <FormField label={t("admin.plan_name_en")} error={errorEn}>
        {(props) => (
          <Input {...props} dir="ltr" lang="en" maxLength={60} {...en} />
        )}
      </FormField>
    </div>
  )
}
