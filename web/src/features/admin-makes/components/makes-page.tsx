import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { makesSearchSchema, type MakesSearch } from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { MakesList } from "./makes-list"
import { ModelsPanel } from "./models-panel"

// Makes on one side, the open make's models on the other. Below lg one shows at a time: the list, or the models once `make` is set.
export function MakesPage() {
  const { t } = useT()
  const title = t("dashboard.nav_makes")
  usePageTitle(title)
  const search = makesSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const go = useCallback(
    (next: MakesSearch) =>
      void navigate({
        to: ".",
        search: next,
        replace: true,
        resetScroll: false,
      }),
    [navigate]
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={search.make ? "hidden lg:block" : undefined}>
          <MakesList search={search} go={go} />
        </div>
        <div className={search.make ? undefined : "hidden lg:block"}>
          <ModelsPanel search={search} go={go} />
        </div>
      </div>
    </div>
  )
}
