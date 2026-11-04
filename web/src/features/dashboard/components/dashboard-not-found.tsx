import { useQuery } from "@tanstack/react-query"
import { FileQuestionIcon } from "lucide-react"

import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { usePageTitle } from "./page-title"

// The unknown-path state inside a dashboard: the sidebar stays, the content says so and points back to the overview.
export function DashboardNotFound() {
  const { t, locale } = useT()
  const { data: me } = useQuery(meQuery)
  usePageTitle(t("error.not_found_title"))
  return (
    <>
      <PageHeader title={t("error.not_found_title")} />
      <EmptyState
        icon={FileQuestionIcon}
        title={t("dashboard.not_found_title")}
        body={t("dashboard.not_found_body")}
        action={
          <a
            href={localeHref(dashboardPath(me?.role), locale)}
            className={buttonVariants()}
          >
            {t("dashboard.back_to_overview")}
          </a>
        }
      />
    </>
  )
}
