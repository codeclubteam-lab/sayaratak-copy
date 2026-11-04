import { useState } from "react"
import { useRequireAuth } from "@/features/auth/auth-gate"
import { useCreateSavedSearch } from "@/features/search/queries"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useActiveFilters } from "@/features/search/use-active-filters"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

// The name is the active filters in words, so no extra dialog stands between the click and the alert. Gated behind sign in.
export function SaveSearchButton({ params }: { params: SearchParams }) {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  const filters = useActiveFilters(params)
  const { mutate, isPending } = useCreateSavedSearch()
  const [saved, setSaved] = useState(false)
  const name =
    filters
      .slice(0, 3)
      .map((f) => f.label)
      .join(" · ") || t("common.saved_search")
  const save = () =>
    requireAuth(
      () =>
        mutate(
          { name: name.slice(0, 60), params, alerts: true },
          {
            onSuccess: () => {
              setSaved(true)
              toast.add({ title: t("search.saved") })
            },
            onError: () => toast.add({ title: t("search.save_error") }),
          }
        ),
      "auth.reason_save_search"
    )
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending || saved}
      onClick={save}
    >
      {saved ? t("search.saved") : t("search.save")}
    </Button>
  )
}
