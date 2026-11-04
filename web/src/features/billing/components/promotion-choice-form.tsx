import { useId, useRef, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "@tanstack/react-router"
import type { z } from "zod"

import { FieldError } from "@/components/app/field-error"
import { PromotionOption } from "@/components/app/promotion-option"
import { SubmitButton } from "@/components/app/submit-button"
import { toast } from "@/components/ui/toast"
import { promotionChoiceSchema } from "@sayaratak/shared/listings/schemas"
import { errorText } from "@/lib/api/error-text"
import { focusFirstInvalid } from "@/lib/focus-invalid"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { PromotionPrice } from "@sayaratak/shared/schemas/billing"
import type { User } from "@sayaratak/shared/schemas/user"
import { useCreatePromotion } from "../queries"
import { useAppForm } from "@/hooks/use-app-form"

type Choice = z.input<typeof promotionChoiceSchema>

// Every price row (Featured for each length, and Bump up) as one radio group. Continue creates the unpaid promotion and opens its checkout in the owner's dashboard. `secondary` is the button beside Continue (Not now, Cancel); `label` names the group for screen readers.
export function PromotionChoiceForm({
  listingId,
  role,
  prices,
  label,
  secondary,
}: {
  listingId: string
  role: User["role"]
  prices: PromotionPrice[]
  label: string
  secondary: ReactNode
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const create = useCreatePromotion()
  const error = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const form = useAppForm<Choice>({
    resolver: zodResolver(promotionChoiceSchema),
  })
  const chosen = form.watch("promotion")
  const message = form.formState.errors.promotion?.message
  const submit = form.handleSubmit(
    async ({ promotion }) => {
      try {
        const promo = await create.mutateAsync({
          listingId,
          priceId: promotion,
        })
        const item = new URLSearchParams({ item: `promotion:${promo.id}` })
        router.history.push(
          localeHref(`${dashboardPath(role)}/billing/checkout?${item}`, locale)
        )
      } catch (e) {
        toast.add({ title: errorText(t, e) })
      }
    },
    () => focusFirstInvalid(formRef.current)
  )
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4"
    >
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={message ? error : undefined}
        aria-invalid={!!message}
        tabIndex={message ? 0 : undefined}
        className="flex flex-col gap-2"
      >
        {prices.map((p) => (
          <PromotionOption
            key={p.id}
            name="promotion"
            value={p.id}
            type={p.type}
            durationDays={p.durationDays}
            price={p.price}
            selected={chosen === p.id}
            onSelect={() =>
              form.setValue("promotion", p.id, { shouldValidate: !!message })
            }
          />
        ))}
      </div>
      <FieldError id={error} message={message} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton variant="signal" pending={form.formState.isSubmitting}>
          {t("post.promo_continue")}
        </SubmitButton>
        {secondary}
      </div>
    </form>
  )
}
