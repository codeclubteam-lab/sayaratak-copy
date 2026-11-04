import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"

// Static blocks at the size of the final content (A5), so nothing jumps when data arrives.
export function GridCard() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-[4/3]" />
      <Skeleton className="mt-2 h-7 w-2/5" />
      <Skeleton className="mt-1 h-5 w-full" />
      <Skeleton className="mt-1 h-5 w-2/3" />
      <Skeleton className="mt-1 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
    </div>
  )
}

const variants = {
  grid: (
    <>
      <Skeleton className="h-8 w-2/3 max-w-sm" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <GridCard key={i} />
        ))}
      </div>
    </>
  ),
  detail: (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Skeleton className="aspect-[4/3]" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/5" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-(--control-h) w-full" />
        <Skeleton className="h-(--control-h) w-full" />
      </div>
    </div>
  ),
  text: (
    <>
      <Skeleton className="h-8 w-1/3 max-w-xs" />
      <div className="flex max-w-[65ch] flex-col gap-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </>
  ),
  table: (
    <>
      <Skeleton className="h-8 w-1/3 max-w-xs" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </>
  ),
}

export type SkeletonVariant = keyof typeof variants

export function PageSkeleton({
  variant = "grid",
}: {
  variant?: SkeletonVariant
}) {
  const { t } = useT()
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6 py-6">
      <span className="sr-only">{t("error.loading")}</span>
      {variants[variant]}
    </div>
  )
}
