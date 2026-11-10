import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { ContactSettings } from "./contact-settings"
import { ListingSettings } from "./listing-settings"
import { PaymentSettings } from "./payment-settings"

// Rules for listings, the Bankak account checkout shows and the public contact details. Each section saves alone.
export function SiteSettingsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_settings")
  usePageTitle(title)
  const settings = useQuery(adminQueries.settings)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("admin.settings_hint")} />
      {settings.data ? (
        <div className="rounded-xl bg-card px-4">
          <ListingSettings settings={settings.data} />
          <PaymentSettings settings={settings.data} />
          <ContactSettings settings={settings.data} />
        </div>
      ) : settings.isError ? (
        <SectionError
          title={title}
          message={t("admin.plans_settings_error")}
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <Skeleton aria-hidden="true" className="h-96 rounded-xl" />
      )}
    </div>
  )
}
