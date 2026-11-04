import { useFormContext, useWatch } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n/use-t"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"

type Details = { name: Bilingual; description: Bilingual; bio: Bilingual }
const langs = ["ar", "en"] as const

// Name and description (a mechanic's bio) in both languages: the public page shows the one that matches the visitor's language.
export function DetailsFields({ person = false }: { person?: boolean }) {
  const { t } = useT()
  // A mechanic's form holds `bio` where a business has `description`.
  const text = person ? "bio" : "description"
  const max = person ? 600 : 1000
  const { register, control, formState } = useFormContext<Details>()
  const description = useWatch({ control, name: text })
  const { errors } = formState
  return (
    <>
      {langs.map((lang) => (
        <FormField
          key={`name-${lang}`}
          label={t(`dashboard.profile_name_${lang}`)}
          error={errors.name?.[lang]?.message}
        >
          {(c) => (
            <Input
              {...c}
              {...register(`name.${lang}`)}
              dir={lang === "ar" ? "rtl" : "ltr"}
              autoComplete={person ? "name" : "organization"}
            />
          )}
        </FormField>
      ))}
      {langs.map((lang) => (
        <FormField
          key={`description-${lang}`}
          label={t(`dashboard.profile_${person ? "bio" : "about"}_${lang}`)}
          error={errors[text]?.[lang]?.message}
          description={`${description[lang].length}/${max}`}
        >
          {(c) => (
            <Textarea
              {...c}
              {...register(`${text}.${lang}`)}
              dir={lang === "ar" ? "rtl" : "ltr"}
              rows={5}
            />
          )}
        </FormField>
      ))}
    </>
  )
}
