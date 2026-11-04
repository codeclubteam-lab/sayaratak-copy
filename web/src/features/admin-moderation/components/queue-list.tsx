import type { UseQueryResult } from "@tanstack/react-query"
import { ListChecksIcon } from "lucide-react"

import { BulkActionBar } from "@/components/app/bulk-action-bar"
import { EmptyState } from "@/components/app/empty-state"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { QueueRow } from "./queue-row"

// The waiting listings, newest first. Bulk approve sits under the rows while some are checked.
export function QueueList({
  query,
  items,
  currentId,
  filtered,
  selected,
  onSelect,
  onOpen,
  onApproveSelected,
}: {
  query: UseQueryResult<unknown>
  items: Listing[]
  currentId: string | undefined
  filtered: boolean
  selected: Set<string>
  onSelect: (next: Set<string>) => void
  onOpen: (id: string) => void
  onApproveSelected: () => void
}) {
  const { t } = useT()
  if (query.isError)
    return (
      <SectionError
        message={t("admin.queue_error")}
        onRetry={() => void query.refetch()}
      />
    )
  if (query.isPending)
    return (
      <div
        className="flex flex-col gap-1 rounded-xl bg-card p-2"
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-18" />
        ))}
      </div>
    )
  if (items.length === 0)
    return (
      <EmptyState
        icon={ListChecksIcon}
        title={t("admin.queue_empty")}
        body={t(
          filtered ? "admin.queue_empty_filtered" : "admin.queue_empty_body"
        )}
        className="rounded-xl bg-card"
      />
    )
  const check = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onSelect(next)
  }
  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label={t("admin.queue_label")}
        className="flex flex-col gap-1 rounded-xl bg-card p-2"
      >
        {items.map((l) => (
          <QueueRow
            key={l.id}
            listing={l}
            current={l.id === currentId}
            checked={selected.has(l.id)}
            onCheck={(on) => check(l.id, on)}
            onOpen={() => onOpen(l.id)}
          />
        ))}
      </ul>
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onClear={() => onSelect(new Set())}
        >
          <Button type="button" onClick={onApproveSelected}>
            {t("admin.approve_selected")}
          </Button>
        </BulkActionBar>
      )}
    </div>
  )
}
