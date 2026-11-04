import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import {
  adminQueries,
  useApproveListing,
  useBulkListings,
  useRejectListing,
  useRemoveListing,
} from "@/features/admin/queries"
import {
  moderationSearchSchema,
  type ModerationSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { reviewKeyHandler, useShortcutsOn } from "../use-review-shortcuts"
import { ListingReview } from "./listing-review"
import { ModerationToolbar } from "./moderation-toolbar"
import { NotInQueue } from "./not-in-queue"
import { QueueList } from "./queue-list"
import { ReviewActions } from "./review-actions"
import { ShortcutsPopover } from "./shortcuts-popover"

const reasons = ["photos", "category", "duplicate", "prohibited", "missing"]
type Send = (o: {
  onSuccess: () => void
  onError: (e: unknown) => void
}) => void
const focusTitle = () =>
  requestAnimationFrame(() => document.getElementById("review-title")?.focus())

// Pending listings on the start side, the open one on the end side (one screen at a time below lg, `listing` in the URL picks which). A decision hides the row at once and opens the next; a failed request brings the row back. No Undo: the seller is already notified.
export function ModerationPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_review_queue")
  usePageTitle(title)
  const search = moderationSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const queue = useQuery(
    adminQueries.moderation({
      type: search.type,
      sellerKind: search.sellerKind,
      pageSize: 100,
    })
  )
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<Listing | null>(null)
  // The ids waiting for the approve confirm: one listing (button or A) or the checked rows.
  const [approving, setApproving] = useState<string[] | null>(null)
  const [shortcuts, setShortcuts] = useShortcutsOn()
  const approve = useApproveListing()
  const reject = useRejectListing()
  const remove = useRemoveListing()
  const bulk = useBulkListings()

  const all = queue.data?.items ?? []
  const items = all.filter((l) => !gone.has(l.id))
  const current = search.listing
    ? items.find((l) => l.id === search.listing)
    : items[0]
  const index = current ? items.indexOf(current) : -1
  const go = (next: Partial<ModerationSearch>, replace = true) =>
    void navigate({
      to: ".",
      search: { ...search, ...next },
      replace,
      resetScroll: false,
      viewTransition: false,
    })

  // Opens another listing; focus on a queue row follows to the new row, so the keys keep working after the old row leaves.
  const show = (id: string | undefined) => {
    const inList = document.activeElement?.closest("[data-queue-row]")
    go({ listing: id })
    if (inList && id)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-queue-row="${id}"]`)?.focus()
      )
  }
  const act = (ids: string[], done: string, send: Send) => {
    const left = items.filter((l) => !ids.includes(l.id))
    setGone((prev) => new Set([...prev, ...ids]))
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
    if (current && ids.includes(current.id))
      show(left[Math.min(index, left.length - 1)]?.id)
    send({
      onSuccess: () => toast.add({ title: done }),
      onError: (e) => {
        setGone((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
        toast.add({ title: errorText(t, e) })
      },
    })
  }
  const approveIds = (ids: string[]) => {
    const [id] = ids
    if (id && ids.length === 1)
      act([id], t("admin.listing_approved"), (o) => approve.mutate(id, o))
    else
      act(ids, t("admin.listings_approved", { count: ids.length }), (o) =>
        bulk.mutate({ ids, action: "approve" }, o)
      )
    focusTitle()
  }

  const onKeyDown = reviewKeyHandler(shortcuts, (action) => {
    if (!current) return
    if (action === "approve") return setApproving([current.id])
    if (action === "reject") return setRejecting(current)
    const next = items[index + (action === "next" ? 1 : -1)]
    if (!next) return
    show(next.id)
  })

  const total = queue.data
    ? queue.data.total - (all.length - items.length)
    : undefined
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={total === undefined ? undefined : formatNumber(total, locale)}
      >
        <ModerationToolbar
          search={search}
          onChange={(next) => {
            setSelected(new Set())
            go({ ...next, listing: undefined })
          }}
        />
        <ShortcutsPopover on={shortcuts} onChange={setShortcuts} />
      </PageHeader>
      <div
        onKeyDown={onKeyDown}
        className={cn(
          "grid items-start gap-6",
          // An empty queue has nothing to review, so its empty state takes the whole width.
          (!queue.isSuccess || items.length > 0) &&
            "lg:grid-cols-[360px_minmax(0,1fr)]"
        )}
      >
        <div className={cn(search.listing && "max-lg:hidden")}>
          <QueueList
            query={queue}
            items={items}
            currentId={current?.id}
            filtered={!!search.type || search.sellerKind !== "all"}
            selected={selected}
            onSelect={setSelected}
            onOpen={(id) => go({ listing: id }, false)}
            onApproveSelected={() => setApproving([...selected])}
          />
        </div>
        <div
          className={cn(
            "flex flex-col gap-4",
            !search.listing && "max-lg:hidden"
          )}
        >
          {search.listing && (
            <Button
              type="button"
              variant="ghost"
              className="self-start lg:hidden"
              onClick={() => go({ listing: undefined })}
            >
              <ArrowLeftIcon aria-hidden="true" className="rtl:-scale-x-100" />
              {t("admin.back_to_queue")}
            </Button>
          )}
          {current ? (
            <ListingReview
              listing={current}
              actions={
                <ReviewActions
                  shortcuts={shortcuts}
                  onApprove={() => setApproving([current.id])}
                  onReject={() => setRejecting(current)}
                  onRemove={() => {
                    act([current.id], t("admin.listing_removed"), (o) =>
                      remove.mutate(current.id, o)
                    )
                    focusTitle()
                  }}
                />
              }
            />
          ) : (
            search.listing &&
            queue.isSuccess && <NotInQueue id={search.listing} />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!approving}
        onOpenChange={(open) => !open && setApproving(null)}
        title={
          approving && approving.length > 1
            ? t("admin.bulk_approve_title", { count: approving.length })
            : t("admin.approve_title")
        }
        description={t(
          approving && approving.length > 1
            ? "admin.approve_body_several"
            : "admin.approve_body"
        )}
        confirmLabel={t("admin.approve")}
        onConfirm={() => {
          if (!approving) return
          setApproving(null)
          approveIds(approving)
        }}
      />
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t("admin.reject_title")}
        label={t("admin.reject_label")}
        confirmLabel={t("admin.reject")}
        chips={reasons.map((r) => t(`admin.reject_${r}`))}
        onConfirm={(reason) => {
          if (!rejecting) return
          const id = rejecting.id
          setRejecting(null)
          act([id], t("admin.listing_rejected"), (o) =>
            reject.mutate({ id, reason }, o)
          )
          focusTitle()
        }}
      />
    </div>
  )
}
