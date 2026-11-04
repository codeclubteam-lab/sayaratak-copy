import { useState } from "react"

import { FieldGrid } from "@/components/app/field-grid"
import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { SubmitButton } from "@/components/app/submit-button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdPage } from "@sayaratak/shared/schemas/ads"
import { useUpdateAdPage } from "../queries"

// One page's weekly price, how many advertisers rotate on it, and whether it is for sale. Saved per row; running campaigns keep the price they paid.
export function AdPriceRow({ page }: { page: AdPage }) {
  const { t } = useT()
  const update = useUpdateAdPage()
  const [price, setPrice] = useState<number | null>(page.weeklyPrice)
  const [slots, setSlots] = useState<number | null>(page.slots)
  const [enabled, setEnabled] = useState(page.enabled)
  const invalid = price === null || price < 0 || slots === null || slots < 1
  const dirty =
    price !== page.weeklyPrice ||
    slots !== page.slots ||
    enabled !== page.enabled
  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        update.mutate(
          { id: page.id, weeklyPrice: price, slots, enabled },
          { onError: (err) => toast.add({ title: errorText(t, err) }) }
        )
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ui font-semibold">{t(`ads.page_${page.id}`)}</h2>
        <Label className="font-normal">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          {t("ads.for_sale")}
        </Label>
      </div>
      <FieldGrid>
        <FormField
          label={t("ads.weekly_price")}
          error={price === null ? "validation.required" : undefined}
        >
          {(c) => (
            <NumberField
              {...c}
              value={price}
              onChange={setPrice}
              min={0}
              grouping
            />
          )}
        </FormField>
        <FormField
          label={t("ads.slots_label")}
          error={
            slots === null || slots < 1 ? "validation.required" : undefined
          }
        >
          {(c) => (
            <NumberField
              {...c}
              value={slots}
              onChange={setSlots}
              min={1}
              max={10}
            />
          )}
        </FormField>
      </FieldGrid>
      <SubmitButton
        className="self-start"
        pending={update.isPending}
        dirty={dirty}
        disabled={!dirty || invalid}
        savedLabel={update.isSuccess}
      >
        {t("common.save")}
      </SubmitButton>
    </form>
  )
}
