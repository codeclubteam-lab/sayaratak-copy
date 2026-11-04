import { useFormContext } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import type { BannerForm } from "../schemas"

const fields = [
  ["eyebrow", 30],
  ["heading", 60],
  ["body", 120],
  ["cta", 24],
] as const

// The four texts over the photo, in one language.
export function BannerCopyFields({ lang }: { lang: "ar" | "en" }) {
  const { t } = useT()
  const {
    register,
    formState: { errors },
  } = useFormContext<BannerForm>()
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-ui font-medium">
        {t(`admin.banners_copy_${lang}`)}
      </legend>
      {fields.map(([name, max]) => (
        <FormField
          key={name}
          label={t(`admin.banners_copy_${name}`)}
          optional={name === "eyebrow"}
          error={errors.copy?.[lang]?.[name]?.message}
        >
          {(props) => (
            <Input
              {...props}
              dir={lang === "ar" ? "rtl" : "ltr"}
              lang={lang}
              maxLength={max}
              {...register(`copy.${lang}.${name}`)}
            />
          )}
        </FormField>
      ))}
    </fieldset>
  )
}
