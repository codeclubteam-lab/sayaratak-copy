import { useCallback, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { MegaphoneIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useGrantPromotion } from "@/features/admin/queries"
import {
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { GrantPromotionDialog } from "@/features/admin-listings/components/grant-promotion-dialog"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { ListingPickerDialog } from "@/components/app/listing-picker-dialog"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { ActivePromotionsTable } from "./active-promotions-table"
import { PricesCard } from "./prices-card"

// Prices, then promotions running now. "Grant promotion" picks any approved listing, then the type and days; the promotion starts at once and costs nothing.
export function AdminPromotionsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_promotions")
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
  const [picking, setPicking] = useState(false)
  const [listingId, setListingId] = useState<string>()
  const grant = useGrantPromotion()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <Button type="button" onClick={() => setPicking(true)}>
          <MegaphoneIcon aria-hidden="true" />
          {t("admin.grant")}
        </Button>
      </PageHeader>
      <PricesCard />
      <section
        aria-labelledby="active-promotions"
        className="flex flex-col gap-3"
      >
        <h2 id="active-promotions" className="text-title font-semibold">
          {t("admin.promos_active_title")}
        </h2>
        <ActivePromotionsTable search={search} go={go} />
      </section>
      <ListingPickerDialog
        open={picking}
        onOpenChange={setPicking}
        onSelect={setListingId}
        title={t("admin.promos_pick_title")}
        source="admin"
      />
      <GrantPromotionDialog
        open={!!listingId}
        onOpenChange={(open) => !open && setListingId(undefined)}
        pending={grant.isPending}
        onConfirm={({ type, days }) => {
          if (!listingId) return
          grant.mutate(
            { listingId, type, days },
            {
              onSuccess: () =>
                toast.add({ title: t("admin.promotion_granted") }),
              onError: (e) => toast.add({ title: errorText(t, e) }),
              onSettled: () => setListingId(undefined),
            }
          )
        }}
      />
    </div>
  )
}
