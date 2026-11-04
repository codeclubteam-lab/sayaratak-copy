import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LayersIcon, PlusIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { adminQueries } from "@/features/admin/queries"
import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { AdminPlanCard } from "./admin-plan-card"
import { PlanFormDialog } from "./plan-form-dialog"
import { usePlanColumns } from "./use-plan-columns"

// One audience's plans under their own heading with Add plan beside it, all on one page in their own order.
export function PlansTable({ audience }: { audience: AdminPlan["audience"] }) {
  const { t } = useT()
  const plans = useQuery(adminQueries.plans)
  const rows = plans.data?.filter((p) => p.audience === audience)
  const [editing, setEditing] = useState<AdminPlan | "new">()
  const columns = usePlanColumns(audience, setEditing)
  const nextOrder = Math.max(-1, ...(rows ?? []).map((p) => p.sortOrder)) + 1
  const headingId = `plans-${audience}`
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-title font-semibold">
          {t(`admin.plans_table_${audience}`)}
        </h2>
        <Button type="button" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          {t("admin.plan_add")}
        </Button>
      </div>
      <DataTable
        label={t(`admin.plans_table_${audience}`)}
        columns={columns}
        data={rows}
        getRowId={(p) => p.id}
        loading={plans.isPending}
        error={plans.isError}
        onRetry={() => void plans.refetch()}
        mobileCard={(p) => (
          <AdminPlanCard plan={p} onEdit={() => setEditing(p)} />
        )}
        empty={
          <EmptyState
            icon={LayersIcon}
            title={t("admin.plans_empty")}
            body={t("admin.plans_empty_body")}
          />
        }
        page={1}
        pageCount={1}
        hrefFor={() => ""}
        onPageChange={() => undefined}
      />
      <PlanFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        audience={audience}
        plan={editing === "new" ? undefined : editing}
        nextOrder={nextOrder}
      />
    </section>
  )
}
