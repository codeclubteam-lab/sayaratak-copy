import type { UseFormReturn } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { BroadcastForm } from "../schemas"

// Title and message in each language, Arabic first; each recipient reads the one of their own language. Each field counts its characters.
export function BroadcastTextFields({
  form,
}: {
  form: UseFormReturn<BroadcastForm>
}) {
  const { t } = useT()
  const { errors } = form.formState
  const column = (lang: "ar" | "en") => {
    const title = lang === "ar" ? "titleAr" : "titleEn"
    const body = lang === "ar" ? "bodyAr" : "bodyEn"
    const dir = lang === "ar" ? "rtl" : "ltr"
    return (
      <div className="flex flex-col gap-4">
        <FormField
          label={t(`admin.broadcast_title_${lang}`)}
          error={errors[title]?.message}
          description={`${form.watch(title).length}/80`}
        >
          {(props) => (
            <Input
              {...props}
              dir={dir}
              lang={lang}
              maxLength={80}
              {...form.register(title)}
            />
          )}
        </FormField>
        <FormField
          label={t(`admin.broadcast_body_${lang}`)}
          error={errors[body]?.message}
          description={`${form.watch(body).length}/300`}
        >
          {(props) => (
            <Textarea
              {...props}
              dir={dir}
              lang={lang}
              rows={4}
              maxLength={300}
              {...form.register(body)}
            />
          )}
        </FormField>
      </div>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {column("ar")}
      {column("en")}
    </div>
  )
}
