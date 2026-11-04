import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { promotionLabel } from "@/lib/promotion"
import type { PromotionPrice } from "@sayaratak/shared/schemas/billing"
import { useUpdatePromotionPrice } from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import { promotionPriceFormSchema, type PromotionPriceForm } from "../schemas"

// Price and length of one price row (a bump has no length). Saving closes the dialog; dealers and sellers see the new price at once.
export function PriceDialog({
  price,
  onClose,
}: {
  price: PromotionPrice | undefined
  onClose: () => void
}) {
  const { t } = useT()
  const update = useUpdatePromotionPrice()
  const form = useAppForm<PromotionPriceForm>({
    resolver: zodResolver(promotionPriceFormSchema),
    mode: "onTouched",
    defaultValues: { durationDays: 7, price: 0 },
  })
  useEffect(() => {
    if (price)
      form.reset({
        durationDays: Math.max(1, price.durationDays),
        price: price.price,
      })
  }, [price, form])
  const { errors } = form.formState
  const name = price ? promotionLabel(t, price) : ""
  return (
    <ResponsiveDialog
      open={!!price}
      onOpenChange={(open) => !open && onClose()}
      title={t("admin.promos_price_edit_title", { name })}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          if (!price) return
          update.mutate(
            { id: price.id, ...values },
            {
              onSuccess: () => {
                toast.add({ title: t("admin.promos_price_saved") })
                onClose()
              },
              onError: (e) => toast.add({ title: errorText(t, e) }),
            }
          )
        })}
      >
        <FormField
          label={t("admin.promos_price_label")}
          error={errors.price?.message}
          className="w-56"
        >
          {(control) => (
            <Controller
              control={form.control}
              name="price"
              render={({ field }) => (
                <NumberField
                  {...control}
                  min={0}
                  max={9_999_999_999}
                  grouping
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </FormField>
        {price?.type !== "bump" && (
          <FormField
            label={t("admin.promos_days_label")}
            error={errors.durationDays?.message}
            className="w-40"
          >
            {(control) => (
              <Controller
                control={form.control}
                name="durationDays"
                render={({ field }) => (
                  <NumberField
                    {...control}
                    min={1}
                    max={90}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </FormField>
        )}
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={update.isPending}>
            {t("common.save")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
