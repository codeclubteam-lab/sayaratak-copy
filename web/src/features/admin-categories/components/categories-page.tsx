import { useT } from "@/lib/i18n/use-t"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { PartCategoriesSection } from "./part-categories-section"
import { VehicleTypesSection } from "./vehicle-types-section"

// Which vehicle types the site shows, and the part categories sellers pick from.
export function AdminCategoriesPage() {
  const { t } = useT()
  const title = t("dashboard.nav_categories")
  usePageTitle(title)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <VehicleTypesSection />
      <PartCategoriesSection />
    </div>
  )
}
