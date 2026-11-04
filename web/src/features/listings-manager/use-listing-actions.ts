import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { toast } from "@/components/ui/toast"
import { meQuery } from "@/features/auth/me-query"
import { apiFetch } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { keys } from "@/lib/api/query-keys"
import { useT } from "@/lib/i18n/use-t"
import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  listingSchema,
  type Listing,
  type ListingStatus,
} from "@sayaratak/shared/schemas/listing"
import {
  useDeleteListing,
  useDuplicateListing,
  useRenewListing,
  useSetListingStatus,
} from "@/features/listings/queries"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Status only changes on an approved listing; sale listings end as sold, rent listings as rented.
export const statusOptions = (l: Listing): ListingStatus[] => [
  "available",
  "reserved",
  l.intent === "rent" ? "rented" : "sold",
]
export const canChangeStatus = (l: Listing) => l.moderation === "approved"
// Renew is open for an approved listing that ends within a week or already ended.
export const canRenew = (l: Listing, now: number) =>
  l.moderation === "approved" && Date.parse(l.expiresAt) - now < WEEK_MS

// Every listing action of the manager, single and bulk, each answered with a toast.
export function useListingActions() {
  const { t, locale } = useT()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const status = useSetListingStatus()
  const renew = useRenewListing()
  const duplicate = useDuplicateListing()
  const remove = useDeleteListing()
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  // A dealership edits inside its dashboard, everyone else on /post.
  const dealer = useQuery(meQuery).data?.role === "dealership"
  const edit = (id: string) =>
    void (dealer
      ? navigate({
          to: "/$locale/dealer/inventory/$id/edit",
          params: { locale, id },
        })
      : navigate({
          to: "/$locale/post",
          params: { locale },
          search: { edit: id },
        }))

  // Bulk runs the single-row endpoints side by side, refreshes once, and reports the count that worked.
  const bulk = async (
    rows: Listing[],
    call: (l: Listing) => Promise<unknown>,
    done: "updated" | "deleted"
  ) => {
    const results = await Promise.allSettled(rows.map(call))
    await Promise.all(
      [
        keys.listings.all,
        keys.counts,
        keys.billing.subscription,
        keys.business.mine,
      ].map((queryKey) => qc.invalidateQueries({ queryKey }))
    )
    const ok = results.filter((r) => r.status === "fulfilled").length
    toast.add({ title: t(`manager.${done}`, { count: ok }) })
    if (ok < rows.length)
      toast.add({
        title: t("manager.partly_failed", { failed: rows.length - ok }),
      })
  }
  const post = (l: Listing, action: string, body?: unknown) =>
    apiFetch(`/listings/${l.id}/${action}`, {
      method: "POST",
      body,
      schema: listingSchema,
    })

  return {
    edit: (l: Listing) => edit(l.id),
    setStatus: (l: Listing, next: ListingStatus) =>
      status.mutate(
        { id: l.id, status: next },
        {
          onSuccess: () => toast.add({ title: t("toast.status_updated") }),
          onError: fail,
        }
      ),
    renew: (l: Listing) =>
      renew.mutate(l.id, {
        onSuccess: () => toast.add({ title: t("manager.renewed") }),
        onError: fail,
      }),
    duplicate: (l: Listing) =>
      duplicate.mutate(l.id, {
        onSuccess: (copy) => {
          toast.add({ title: t("manager.duplicated") })
          edit(copy.id)
        },
        onError: fail,
      }),
    remove: (l: Listing) =>
      remove.mutate(l.id, {
        onSuccess: () => toast.add({ title: t("manager.deleted") }),
        onError: fail,
      }),
    closeAll: (rows: Listing[]) =>
      bulk(
        rows.filter(canChangeStatus),
        (l) =>
          post(l, "status", {
            status: l.intent === "rent" ? "rented" : "sold",
          }),
        "updated"
      ),
    renewAll: (rows: Listing[], now: number) =>
      bulk(
        rows.filter((l) => canRenew(l, now)),
        (l) => post(l, "renew"),
        "updated"
      ),
    removeAll: (rows: Listing[]) =>
      bulk(
        rows,
        (l) =>
          apiFetch(`/listings/${l.id}`, { method: "DELETE", schema: okSchema }),
        "deleted"
      ),
  }
}
