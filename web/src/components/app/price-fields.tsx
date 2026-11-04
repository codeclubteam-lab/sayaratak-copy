import { useT } from "@/lib/i18n/use-t"
import { formatPrice } from "@/lib/format"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FormField } from "./form-field"
import { NumberField } from "./number-field"

export type PriceValue = { price: number | null; negotiable: boolean }

// The price and the negotiable box. A rent listing adds RentPeriodSelect next to it.
export function PriceFields({
  value,
  onChange,
  error,
}: {
  value: PriceValue
  onChange: (value: PriceValue) => void
  error?: string
}) {
  const { t, locale } = useT()
  return (
    <div className="flex flex-col gap-3">
      <FormField label={t("form.price")} error={error}>
        {(control) => (
          <div className="flex items-center gap-2">
            <NumberField
              {...control}
              grouping
              min={0}
              value={value.price}
              onChange={(price) => onChange({ ...value, price })}
            />
            <span className="text-caption text-muted-foreground">
              {formatPrice(0, locale).unit}
            </span>
          </div>
        )}
      </FormField>
      <Label className="min-h-(--row-h) font-normal">
        <Checkbox
          checked={value.negotiable}
          onCheckedChange={(negotiable) => onChange({ ...value, negotiable })}
        />
        {t("form.negotiable")}
      </Label>
    </div>
  )
}
