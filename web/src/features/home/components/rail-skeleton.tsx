import { useT } from "@/lib/i18n/use-t"
import { GridCard } from "@/components/app/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Title and four cards at the final size, so the page does not jump when the rail arrives.
export function RailSkeleton() {
  const { t } = useT()
  return (
    <div
      role="status"
      aria-label={t("common.loading")}
      className="flex flex-col gap-5"
    >
      <Skeleton className="h-7 w-40" />
      <div className="flex gap-3 overflow-hidden lg:grid lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="w-60 shrink-0 p-2 lg:w-auto">
            <GridCard />
          </div>
        ))}
      </div>
    </div>
  )
}
