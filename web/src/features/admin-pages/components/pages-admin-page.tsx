import { useSearch } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { pagesSearchSchema } from "../schemas"
import { PageEditor } from "./page-editor"
import { PageList } from "./page-list"

// The four fixed pages on one side, the open one's editor on the other.
export function PagesAdminPage() {
  const { t } = useT()
  const title = t("dashboard.nav_pages")
  usePageTitle(title)
  const { page } = pagesSearchSchema.parse(useSearch({ strict: false }))
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("admin.pages_hint")} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <PageList current={page} />
        <PageEditor key={page} slug={page} />
      </div>
    </div>
  )
}
