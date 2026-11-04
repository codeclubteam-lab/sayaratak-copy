import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"

import { PageHeader } from "@/components/app/page-header"
import { WelcomeNotice } from "@/features/account-overview/components/welcome-notice"
import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { meQuery } from "@/features/auth/me-query"
import { getCopy } from "@/lib/i18n/server"
import { useT } from "@/lib/i18n/use-t"
import { buildHead } from "@/lib/seo"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { usePageTitle } from "./components/page-title"

function Overview() {
  const { t } = useT()
  usePageTitle(t("dashboard.nav_overview"))
  const { welcome } = overviewSearchSchema.parse(useSearch({ strict: false }))
  const role = useQuery(meQuery).data?.role
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.nav_overview")} />
      {welcome === 1 && role && role !== "admin" && (
        <WelcomeNotice role={role} />
      )}
    </div>
  )
}

// Loader and head of a dashboard page: its title (a message key) as the tab title, never indexed. Every dashboard route uses it.
export const dashboardPage = (path: string, titleKey: string) => ({
  loader: async ({ context }: { context: { locale: Locale } }) => {
    const [title = ""] = await getCopy({
      data: { locale: context.locale, keys: [titleKey] },
    })
    return { title, locale: context.locale }
  },
  head: ({ loaderData }: { loaderData?: { title: string; locale: Locale } }) =>
    loaderData ? buildHead({ ...loaderData, path, noindex: true }) : {},
})

// Route options shared by the five overview pages. Steps 9.1, 10.1, 11.1, 12.1 and 13.2 replace the component.
export const overviewRoute = (path: string) => ({
  ...dashboardPage(path, "dashboard.nav_overview"),
  validateSearch: overviewSearchSchema,
  component: Overview,
})
