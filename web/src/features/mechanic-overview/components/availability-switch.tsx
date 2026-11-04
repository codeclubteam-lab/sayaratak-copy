import { useQuery } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import {
  businessQueries,
  useUpdateBusiness,
} from "@/features/directory/queries"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"

// "Available for new work": saves on each toggle and shows the badge visitors see on the public profile. While the save runs the switch shows the new state and ignores presses (still focusable, `aria-busy`), so two saves never race.
export function AvailabilitySwitch() {
  const { t } = useT()
  const business = useQuery(businessQueries.mine)
  const update = useUpdateBusiness()
  const saved =
    business.data && "available" in business.data
      ? business.data.available
      : undefined
  const available = update.isPending
    ? update.variables.available === true
    : saved
  return business.isError ? (
    <SectionError
      message={t("dashboard.availability_error")}
      onRetry={() => void business.refetch()}
    />
  ) : available === undefined ? (
    <Skeleton className="h-11" aria-hidden="true" />
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-3 text-ui">
        <Switch
          checked={available}
          aria-busy={update.isPending}
          onCheckedChange={(next) =>
            !update.isPending &&
            update.mutate(
              { available: next },
              {
                onSuccess: () =>
                  toast.add({ title: t("toast.availability_saved") }),
                onError: (error) => toast.add({ title: errorText(t, error) }),
              }
            )
          }
        />
        {t("dashboard.availability_label")}
      </label>
      <span className="flex items-center gap-2 text-caption text-muted-foreground">
        {t("dashboard.availability_public")}
        <Badge variant={available ? "success" : "muted"}>
          {t(available ? "directory.available" : "directory.busy")}
        </Badge>
      </span>
    </div>
  )
}
