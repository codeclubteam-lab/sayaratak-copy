import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { MegaphoneIcon } from "lucide-react"

import { ListingPickerDialog } from "@/components/app/listing-picker-dialog"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import { billingQueries } from "../queries"
import { promotionTabs, promotionsSearchSchema } from "../schemas"
import { PromoteDialog } from "./promote-dialog"
import { PromotionPriceCards } from "./promotion-price-cards"
import { PromotionsTable } from "./promotions-table"

const inTab = {
  active: (p: MyPromotion) => p.status === "active",
  ended: (p: MyPromotion) => p.status === "ended",
  waiting: (p: MyPromotion) => p.status === "pending_payment",
}

// The dealer's promotions: prices, then every promotion by tab. "Promote a listing" picks a listing, then the promote dialog takes it to checkout.
export function PromotionsPage() {
  const { t, locale } = useT()
  const { tab } = promotionsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const list = useQuery(billingQueries.promotions)
  const [picking, setPicking] = useState(false)
  const [listingId, setListingId] = useState<string>()
  const title = t("dashboard.nav_promotions")
  usePageTitle(title)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <Button type="button" onClick={() => setPicking(true)}>
          <MegaphoneIcon aria-hidden="true" />
          {t("billing.promos_promote")}
        </Button>
      </PageHeader>
      <PromotionPriceCards />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          void navigate({
            to: ".",
            search: { tab: promotionsSearchSchema.shape.tab.parse(next) },
            replace: true,
            resetScroll: false,
          })
        }
      >
        <TabsList
          aria-label={t("billing.promos_tabs_label")}
          className="max-w-full overflow-x-auto"
        >
          {promotionTabs.map((value) => {
            const count = list.data?.filter(inTab[value]).length
            return (
              <TabsTrigger key={value} value={value}>
                {t(`billing.promos_tab_${value}`)}
                {count !== undefined && (
                  <span className="text-muted-foreground num">
                    {formatNumber(count, locale)}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <TabsContent value={tab}>
          <PromotionsTable
            tab={tab}
            rows={list.data?.filter(inTab[tab])}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
          />
        </TabsContent>
      </Tabs>
      <ListingPickerDialog
        open={picking}
        onOpenChange={setPicking}
        onSelect={setListingId}
        title={t("billing.promos_pick_title")}
      />
      {listingId && (
        <PromoteDialog
          listingId={listingId}
          onClose={() => setListingId(undefined)}
        />
      )}
    </div>
  )
}
