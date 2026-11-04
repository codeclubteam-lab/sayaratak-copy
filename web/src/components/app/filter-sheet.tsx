import { useState } from "react"

import { filterKeys, type FilterGroup } from "@/features/search/filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useIsMobile } from "@/hooks/use-mobile"
import { useT } from "@/lib/i18n/use-t"
import type { ListingPage } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { FilterForm } from "./filter-form"

// The same form in a full-height bottom sheet below md and in a dialog from md up. Applying closes it.
export function FilterSheet({
  params,
  facets,
  groups,
  triggerClassName = "lg:hidden",
  onApply,
}: {
  params: SearchParams
  facets?: ListingPage["facets"]
  groups?: readonly FilterGroup[]
  // The results page has a side panel from `lg`, so the sheet button hides there; the map has no panel and keeps it.
  triggerClassName?: string
  onApply: (next: SearchParams) => void
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const active =
    filterKeys.filter(
      (k) =>
        k !== "lat" &&
        k !== "lng" &&
        k !== "includeSold" &&
        params[k] !== undefined
    ).length + (params.includeSold ? 1 : 0)
  const mobile = useIsMobile()
  const form = (
    <FilterForm
      variant="sheet"
      params={params}
      facets={facets}
      groups={groups}
      onApply={(next) => {
        onApply(next)
        setOpen(false)
      }}
    />
  )
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {t("common.filters")}
        {active > 0 && <span className="num">({active})</span>}
      </Button>
      {mobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-dvh overflow-y-auto px-4">
            <SheetHeader>
              <SheetTitle>{t("search.filters_title")}</SheetTitle>
            </SheetHeader>
            {form}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("search.filters_title")}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
