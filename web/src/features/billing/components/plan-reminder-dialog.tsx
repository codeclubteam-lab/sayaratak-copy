import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useRouter } from "@tanstack/react-router"

import { PlansGrid } from "@/components/app/plans-grid"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { takeSignIn } from "@/lib/sign-in-flag"
import type { User } from "@sayaratak/shared/schemas/user"
import { billingQueries, useKeepFreePlan } from "../queries"

// Once per sign in, while a paid plan picked in onboarding waits for payment: the free plan next to the picked one, the price and what happens next. "Not now" asks again at the next sign in; "Keep the free plan" stops asking. Never over a checkout.
export function PlanReminderDialog({ me }: { me: User }) {
  const { t, locale } = useT()
  const router = useRouter()
  const pathname = useLocation({ select: (l) => l.pathname })
  const [armed, setArmed] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (takeSignIn()) setArmed(true)
  }, [])
  const plans = useQuery({
    ...billingQueries.plans(me.role),
    enabled: Boolean(me.chosenPlanId),
  })
  const keep = useKeepFreePlan()
  const chosen = plans.data?.find((p) => p.id === me.chosenPlanId)
  const free = plans.data?.find((p) => p.price === 0)
  const open =
    armed && Boolean(chosen && free) && !pathname.includes("/billing/checkout")
  if (!chosen || !free) return null
  const close = () => setArmed(false)
  const checkout = `${dashboardPath(me.role)}/billing/checkout?${new URLSearchParams({ item: `plan:${chosen.id}` })}`
  const { amount, unit } = formatPrice(chosen.price, locale)
  const name = chosen.name[locale]
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {/* Focus starts on the title, so a phone opens at the top of the dialog, not scrolled to the first button. */}
      <DialogContent
        initialFocus={title}
        className="max-h-[90dvh] gap-6 overflow-y-auto p-6 sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1} className="outline-none">
            {/* The type role sits on its own element: cn() would drop it next to the title's own text size. */}
            <span className="text-title leading-tight font-semibold">
              {t("billing.reminder_title", { plan: name })}
            </span>
          </DialogTitle>
          <DialogDescription>
            <span className="text-body">
              {t("billing.reminder_body", {
                plan: name,
                price: `${amount} ${unit}`,
                days: chosen.durationDays,
                free: free.name[locale],
              })}
            </span>
          </DialogDescription>
        </DialogHeader>
        <PlansGrid
          mode="action"
          plans={[free, chosen]}
          currentId={free.id}
          onAction={() => {
            close()
            router.history.push(localeHref(checkout, locale))
          }}
        />
        <DialogFooter className="-mx-6 -mb-6 p-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={keep.isPending}
            onClick={() => keep.mutate(undefined, { onSuccess: close })}
          >
            {t("billing.reminder_keep_free", { plan: free.name[locale] })}
          </Button>
          <Button type="button" variant="outline" onClick={close}>
            {t("billing.reminder_later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
