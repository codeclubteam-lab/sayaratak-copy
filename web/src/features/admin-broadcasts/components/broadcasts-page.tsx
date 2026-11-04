import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import {
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { BroadcastForm } from "./broadcast-form"
import { HistoryTable } from "./history-table"

// Write a notification in both languages, pick who gets it, send; below, what was sent before.
export function BroadcastsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_broadcasts")
  usePageTitle(title)
  const search = adminTableSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const go = useCallback(
    (next: AdminTableSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("admin.broadcast_hint")} />
      <BroadcastForm />
      <section
        aria-labelledby="broadcast-history"
        className="flex flex-col gap-3"
      >
        <h2 id="broadcast-history" className="text-title font-semibold">
          {t("admin.broadcast_history")}
        </h2>
        <HistoryTable search={search} go={go} />
      </section>
    </div>
  )
}
