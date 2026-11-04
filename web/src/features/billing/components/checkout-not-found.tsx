import { SearchXIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { Plan } from "@sayaratak/shared/schemas/billing"

// An unknown, foreign or already paid item: the checkout says so inside the dashboard and points back to billing.
export function CheckoutNotFound({ audience }: { audience: Plan["audience"] }) {
  const { t, locale } = useT()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("billing.checkout_title")} />
      <EmptyState
        icon={SearchXIcon}
        title={t("billing.not_found_title")}
        body={t("billing.not_found_body")}
        action={
          <a
            href={localeHref(`${dashboardPath(audience)}/billing`, locale)}
            className={buttonVariants()}
          >
            {t("dashboard.nav_billing")}
          </a>
        }
      />
    </div>
  )
}
