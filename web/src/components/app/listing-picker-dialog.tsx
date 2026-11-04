import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CarIcon } from "lucide-react"

import { adminQueries } from "@/features/admin/queries"
import { listingQueries } from "@/features/listings/queries"
import { useDebounced } from "@/hooks/use-debounced"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "./empty-state"
import { MediaImage } from "./media-image"
import { PriceText } from "./price-text"
import { ResponsiveDialog } from "./responsive-dialog"

// Approved listings, searchable by title: the owner's own (`source="me"`, active ones) or every seller's (`source="admin"`, for granting a promotion). Returns one id and closes.
export function ListingPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title,
  source = "me",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (listingId: string) => void
  title: string
  source?: "me" | "admin"
}) {
  const { t } = useT()
  const [q, setQ] = useState("")
  const search = useDebounced(q.trim())
  const q2 = search || undefined
  const mine = useQuery({
    ...listingQueries.mine({ tab: "active", q: q2 }),
    enabled: open && source === "me",
  })
  const everyone = useQuery({
    ...adminQueries.listings({ moderation: "approved", q: q2 }),
    enabled: open && source === "admin",
  })
  const { data, isError, refetch } = source === "admin" ? everyone : mine
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title}>
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t("form.search_listings")}
        placeholder={t("form.search_listings")}
      />
      <div className="max-h-80 overflow-y-auto" aria-busy={!data && !isError}>
        {isError ? (
          <div role="alert" className="flex flex-col items-start gap-2 py-4">
            <p className="text-ui text-destructive">
              {t("form.listings_error")}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : !data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" aria-hidden="true" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={CarIcon}
            title={t("form.no_listings")}
            level={3}
            className="py-6"
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.items.map((listing) => (
              <li key={listing.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-muted"
                  onClick={() => {
                    onSelect(listing.id)
                    onOpenChange(false)
                  }}
                >
                  <MediaImage
                    src={listing.media[0]?.url ?? null}
                    alt=""
                    placeholderColor={listing.media[0]?.placeholderColor}
                    sizes="64px"
                    className="size-16 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-ui font-medium">
                      <bdi>{listing.title}</bdi>
                    </span>
                    <PriceText price={listing.price} size="table" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ResponsiveDialog>
  )
}
