import type { UseFormReturn } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { PageForm } from "../schemas"

// Title and body in one language. The body hint teaches the three marks `parseBody` reads.
export function PageFields({
  form,
  lang,
}: {
  form: UseFormReturn<PageForm>
  lang: "ar" | "en"
}) {
  const { t } = useT()
  const { errors } = form.formState
  const title = lang === "ar" ? "titleAr" : "titleEn"
  const body = lang === "ar" ? "bodyAr" : "bodyEn"
  const dir = lang === "ar" ? "rtl" : "ltr"
  return (
    <div className="flex flex-col gap-4">
      <FormField
        label={t(`admin.pages_title_${lang}`)}
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
        label={t(`admin.pages_body_${lang}`)}
        error={errors[body]?.message}
        description={`${t("admin.pages_body_hint")} ${form.watch(body).length}/10000`}
      >
        {(props) => (
          <Textarea
            {...props}
            dir={dir}
            lang={lang}
            rows={18}
            maxLength={10000}
            className="min-h-80"
            {...form.register(body)}
          />
        )}
      </FormField>
    </div>
  )
}
