import { MapPinOffIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { MapPoint } from "@sayaratak/shared/schemas/responses"
import { EmptyState } from "@/components/app/empty-state"
import { ResultsRegion } from "@/components/app/results-region"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { PointSummary } from "./point-summary"

// The pins on screen as a list. Pressing a row pans the map to its pin and opens the popup.
export function MapResults({
  items,
  total,
  stale,
  pending,
  failed,
  selectedId,
  onPick,
  onRetry,
}: {
  items: MapPoint[]
  total: number
  stale: boolean
  pending: boolean
  failed: boolean
  selectedId?: string
  onPick: (point: MapPoint) => void
  onRetry: () => void
}) {
  const { t } = useT()
  if (failed)
    return <SectionError message={t("map.load_error")} onRetry={onRetry} />
  if (pending)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-16 w-full" />
        ))}
      </div>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {total > items.length && (
        <p className="text-caption text-muted-foreground">
          {t("search.too_many_on_map", { count: total })}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={MapPinOffIcon}
          title={t("map.empty")}
          level={3}
          className="py-6"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ResultsRegion stale={stale}>
            <ul className="flex flex-col gap-1">
              {items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className={`w-full rounded-lg p-2 text-start motion-color hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${p.id === selectedId ? "bg-muted" : ""}`}
                  >
                    <PointSummary point={p} />
                  </button>
                </li>
              ))}
            </ul>
          </ResultsRegion>
        </div>
      )}
    </div>
  )
}
