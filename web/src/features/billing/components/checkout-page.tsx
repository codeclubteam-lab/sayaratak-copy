import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"

import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import { defaultProvider } from "../providers"
import { billingQueries } from "../queries"
import { checkoutSearchSchema } from "../schemas"
import { OrderSummary } from "./order-summary"
import { SubmittedState } from "./submitted-state"

// Pay for a plan or a promotion (`?item=plan:<id>` or `promotion:<id>`). The route loader has already fetched the checkout, so an unknown or foreign item never gets here.
export function CheckoutPage({ audience }: { audience: Plan["audience"] }) {
  const { t, locale } = useT()
  const { item } = checkoutSearchSchema.parse(useSearch({ strict: false }))
  const checkout = useQuery(billingQueries.checkout(item))
  const title = t("billing.checkout_title")
  usePageTitle(title)
  const base = dashboardPath(audience)
  const { Instructions, Form, labelKey } = defaultProvider
  const data = checkout.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <a
          href={localeHref(`${base}/billing`, locale)}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("common.back")}
        </a>
      </PageHeader>
      {!data ? (
        <SectionError
          message={t("error.load")}
          onRetry={() => void checkout.refetch()}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <OrderSummary checkout={data} methodLabel={t(labelKey)} />
          <div className="flex max-w-2xl flex-col gap-6">
            {data.pendingPaymentId ? (
              <SubmittedState base={base} />
            ) : (
              <>
                <Instructions checkout={data} />
                <Form checkout={data} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
