import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { useAssignPlan } from "@/features/admin/queries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { AssignPlanDialog } from "./assign-plan-dialog"
import type { BusinessChange } from "./business-change"
import { BusinessDetails } from "./business-details"

// One business with Verify or Unverify, Suspend or Reactivate (the page's dialog asks first) and Assign plan.
export function BusinessSheet({
  open,
  business,
  missing,
  onClose,
  onAsk,
}: {
  open: boolean
  business: AdminBusiness | undefined
  // The `id` in the URL matches nothing.
  missing: boolean
  onClose: () => void
  onAsk: (change: BusinessChange) => void
}) {
  const { t } = useT()
  const [assigning, setAssigning] = useState(false)
  const assign = useAssignPlan()
  const footer = business && (
    <>
      <Button type="button" onClick={() => setAssigning(true)}>
        {t("admin.business_assign_plan")}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onAsk({ business, action: business.verified ? "unverify" : "verify" })
        }
      >
        {t(
          business.verified
            ? "admin.business_unverify"
            : "admin.business_verify"
        )}
      </Button>
      {business.status === "active" ? (
        <Button
          type="button"
          variant="destructive"
          onClick={() => onAsk({ business, action: "suspend" })}
        >
          {t("admin.business_suspend")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => onAsk({ business, action: "reactivate" })}
        >
          {t("admin.business_reactivate")}
        </Button>
      )}
    </>
  )

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={t(
          `admin.business_sheet_title_${business?.type ?? "dealership"}`
        )}
        footer={footer}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.business_not_found")}
          </p>
        ) : !business ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-14" />
            <Skeleton className="h-40" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <BusinessDetails business={business} />
        )}
      </EntitySheet>
      {business && (
        <AssignPlanDialog
          open={assigning}
          onOpenChange={setAssigning}
          business={business}
          pending={assign.isPending}
          onConfirm={(value) =>
            assign.mutate(
              {
                id: business.id,
                planId: value.planId,
                price: value.customPrice ?? undefined,
                limit: value.customLimit ?? undefined,
                durationDays: value.durationDays ?? undefined,
                note: value.note || undefined,
              },
              {
                onSuccess: () => {
                  setAssigning(false)
                  toast.add({ title: t("admin.business_plan_assigned_toast") })
                },
                onError: (e) => toast.add({ title: errorText(t, e) }),
              }
            )
          }
        />
      )}
    </>
  )
}
