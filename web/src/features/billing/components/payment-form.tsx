import { useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"

import { FormField } from "@/components/app/form-field"
import { ImageFileInput } from "@/components/app/image-file-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { keys } from "@/lib/api/query-keys"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import type { Checkout } from "@sayaratak/shared/schemas/responses"
import { useCreatePayment } from "../queries"
import { paymentFormSchema, type PaymentForm as Values } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

const fieldNames = ["payerName", "transactionRef", "receipt"] as const

// Who sent the money, the Bankak transaction number and a photo of the receipt. Sending saves a payment waiting for an admin; the page then shows its pending state.
export function PaymentForm({ checkout }: { checkout: Checkout }) {
  const { t } = useT()
  const qc = useQueryClient()
  const create = useCreatePayment()
  const formRef = useRef<HTMLFormElement>(null)
  const form = useAppForm<Values>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onTouched",
    defaultValues: { payerName: "", transactionRef: "" },
  })
  const { errors } = form.formState
  const receipt = form.watch("receipt")
  const submit = form.handleSubmit(
    (values) =>
      create.mutate(
        { itemType: checkout.itemType, itemId: checkout.itemId, ...values },
        {
          onError: (error) => {
            const fields = error instanceof ApiError ? error.fields : undefined
            for (const name of fieldNames)
              if (fields?.[name]) form.setError(name, { message: fields[name] })
            if (!fields) toast.add({ title: errorText(t, error) })
            // Another tab may have sent it already: reload the checkout to show its pending state.
            void qc.invalidateQueries({ queryKey: keys.billing.all })
          },
        }
      ),
    () => focusFirstInvalid(formRef.current)
  )
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4"
    >
      <FormField
        label={t("billing.payer_name")}
        error={errors.payerName?.message}
      >
        {(control) => (
          <Input
            {...control}
            autoComplete="name"
            maxLength={80}
            {...form.register("payerName")}
          />
        )}
      </FormField>
      <FormField
        label={t("billing.transaction_ref")}
        error={errors.transactionRef?.message}
      >
        {(control) => (
          <Input
            {...control}
            dir="ltr"
            inputMode="numeric"
            maxLength={40}
            {...form.register("transactionRef")}
          />
        )}
      </FormField>
      <FormField label={t("billing.receipt")} error={errors.receipt?.message}>
        {(control) => (
          <ImageFileInput
            value={receipt}
            control={control}
            labels={{
              choose: t("billing.receipt_choose"),
              preview: t("billing.receipt_preview"),
              remove: t("billing.receipt_remove"),
            }}
            onChange={(file) =>
              form.setValue("receipt", file as File, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        )}
      </FormField>
      <SubmitButton className="self-start" pending={create.isPending}>
        {t("billing.submit_payment")}
      </SubmitButton>
    </form>
  )
}
