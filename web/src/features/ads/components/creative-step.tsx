import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext } from "react-hook-form"

import { CoverUpload } from "@/components/app/cover-upload"
import { FieldError } from "@/components/app/field-error"
import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n/use-t"
import { adsQueries } from "../queries"
import type { CampaignForm } from "../schemas"

const langs = ["en", "ar"] as const

// Step 1: one photo, the text in both languages, and where the banner links (the advertiser's own profile or listings only).
export function CreativeStep() {
  const { t, locale } = useT()
  const { control, register, formState } = useFormContext<CampaignForm>()
  const targets = useQuery(adsQueries.targets).data ?? []
  const errors = formState.errors
  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={control}
        name="cover"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1">
            <CoverUpload
              label={t("ads.photo_label")}
              value={field.value ?? null}
              onChange={field.onChange}
            />
            <FieldError message={fieldState.error?.message} />
          </div>
        )}
      />
      {langs.map((lang) => (
        <fieldset key={lang} className="flex flex-col gap-4">
          <legend className="mb-2 text-ui font-semibold">
            {t(`ads.text_${lang}`)}
          </legend>
          <div className="contents">
            <FormField
              label={t("ads.heading_label")}
              description={t("ads.heading_hint")}
              error={errors.copy?.[lang]?.heading?.message}
            >
              {(c) => (
                <Input
                  {...c}
                  {...register(`copy.${lang}.heading`)}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                />
              )}
            </FormField>
            <FormField
              label={t("ads.body_label")}
              optional
              error={errors.copy?.[lang]?.body?.message}
            >
              {(c) => (
                <Input
                  {...c}
                  {...register(`copy.${lang}.body`)}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                />
              )}
            </FormField>
            <FormField
              label={t("ads.cta_label")}
              description={t("ads.cta_hint")}
              error={errors.copy?.[lang]?.cta?.message}
            >
              {(c) => (
                <Input
                  {...c}
                  {...register(`copy.${lang}.cta`)}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  lang={lang}
                />
              )}
            </FormField>
          </div>
        </fieldset>
      ))}
      <Controller
        control={control}
        name="href"
        render={({ field, fieldState }) => (
          <FormField
            label={t("ads.link_label")}
            description={t("ads.link_hint")}
            error={fieldState.error?.message}
          >
            {(c) => (
              <SelectInput
                {...c}
                value={field.value}
                onChange={field.onChange}
                placeholder={t("ads.link_placeholder")}
                options={targets.map((x) => ({
                  value: x.href,
                  label: x.label[locale],
                }))}
              />
            )}
          </FormField>
        )}
      />
    </div>
  )
}
