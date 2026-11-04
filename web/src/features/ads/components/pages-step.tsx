import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { FieldError } from "@/components/app/field-error"
import { SectionError } from "@/components/app/section-error"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import { adsQueries } from "../queries"
import type { CampaignForm } from "../schemas"

// Step 3: each page with its weekly price and the slots still free for the chosen dates. A full page cannot be picked.
export function PagesStep() {
  const { t, locale } = useT()
  const { control } = useFormContext<CampaignForm>()
  const [startDate, weeks] = useWatch({ control, name: ["startDate", "weeks"] })
  const pages = useQuery(adsQueries.pages({ startDate, weeks }))
  if (pages.isError)
    return (
      <SectionError
        message={t("ads.pages_error")}
        onRetry={() => void pages.refetch()}
      />
    )
  if (!pages.data)
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" aria-hidden="true" />
        ))}
      </div>
    )
  const rows = pages.data
  return (
    <Controller
      control={control}
      name="pages"
      render={({ field, fieldState }) => {
        const toggle = (id: AdPageId) =>
          field.onChange(
            field.value.includes(id)
              ? field.value.filter((x) => x !== id)
              : [...field.value, id]
          )
        return (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-ui font-semibold">
              {t("ads.pages_legend")}
            </legend>
            {rows.map((p) => {
              const full = p.free < 1
              const { amount, unit } = formatPrice(p.weeklyPrice, locale)
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-xl bg-card p-4",
                    full
                      ? "opacity-60"
                      : "cursor-pointer has-checked:ring-2 has-checked:ring-primary"
                  )}
                >
                  <Checkbox
                    checked={field.value.includes(p.id)}
                    disabled={full}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ui font-medium">
                      {t(`ads.page_${p.id}`)}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {full
                        ? t("ads.page_full")
                        : t("ads.slots_free", { free: p.free, slots: p.slots })}
                    </span>
                  </span>
                  <span className="text-ui font-semibold num">
                    {amount}{" "}
                    <span className="text-caption font-normal text-muted-foreground">
                      {unit} / {t("ads.per_week")}
                    </span>
                  </span>
                </label>
              )
            })}
            <FieldError message={fieldState.error?.message} />
          </fieldset>
        )
      }}
    />
  )
}
