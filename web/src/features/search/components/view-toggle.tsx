import { LayoutGridIcon, ListIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { usePrefs, useSetPrefs } from "@/lib/prefs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Grid or row, remembered in the `listing_view` cookie so the server renders the same view next time.
export function ViewToggle() {
  const { t } = useT()
  const { listingView } = usePrefs()
  const setPrefs = useSetPrefs()
  return (
    <ToggleGroup
      aria-label={t("search.view_label")}
      variant="outline"
      spacing={0}
      value={[listingView]}
      onValueChange={(next) => {
        // One of the two is always on: pressing the chosen one again keeps it.
        const view = next.find((v) => v === "grid" || v === "row")
        if (view) setPrefs({ listingView: view })
      }}
    >
      <ToggleGroupItem value="grid" aria-label={t("search.view_grid")}>
        <LayoutGridIcon aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem value="row" aria-label={t("search.view_row")}>
        <ListIcon aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
