import { useState } from "react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { AdminListing } from "@sayaratak/shared/schemas/admin"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import {
  useAdminUpdateListing,
  useApproveListing,
  useGrantPromotion,
  useRejectListing,
  useRemoveListing,
  useRestoreListing,
} from "@/features/admin/queries"
import { ListingReview } from "@/features/admin-moderation/components/listing-review"
import { ConfirmButton } from "@/components/app/confirm-button"
import { RemoveButton } from "@/components/app/remove-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { GrantPromotionDialog } from "./grant-promotion-dialog"
import { ListingControls } from "./listing-controls"

const rejectChips = ["photos", "category", "duplicate", "prohibited", "missing"]

// One listing, read only, with every admin action. The review state goes through the same endpoints as the queue, so the seller is told; status is a plain edit.
export function AdminListingSheet({
  open,
  listing,
  missing,
  onClose,
}: {
  open: boolean
  listing: AdminListing | undefined
  // The `id` in the URL matches no listing.
  missing: boolean
  onClose: () => void
}) {
  const { t } = useT()
  const [dialog, setDialog] = useState<"reject" | "grant" | null>(null)
  const approve = useApproveListing()
  const reject = useRejectListing()
  const remove = useRemoveListing()
  const restore = useRestoreListing()
  const update = useAdminUpdateListing()
  const grant = useGrantPromotion()
  const settle = (done: string) => ({
    onSuccess: () => {
      setDialog(null)
      toast.add({ title: done })
    },
    onError: (e: unknown) => toast.add({ title: errorText(t, e) }),
  })
  const m = listing?.moderation
  const footer = listing && (
    <>
      {(m === "pending" || m === "rejected") && (
        <ConfirmButton
          disabled={approve.isPending}
          title={t("admin.approve_title")}
          description={t("admin.approve_body")}
          confirmLabel={t("admin.approve")}
          onConfirm={() =>
            approve.mutate(listing.id, settle(t("admin.listing_approved")))
          }
        >
          {t("admin.approve")}
        </ConfirmButton>
      )}
      {(m === "pending" || m === "approved") && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog("reject")}
        >
          {t("admin.reject")}
        </Button>
      )}
      {m === "removed" ? (
        <ConfirmButton
          disabled={restore.isPending}
          title={t("admin.restore_title")}
          description={t("admin.approve_body")}
          confirmLabel={t("admin.restore")}
          onConfirm={() =>
            restore.mutate(listing.id, settle(t("admin.listing_restored")))
          }
        >
          {t("admin.restore")}
        </ConfirmButton>
      ) : (
        <RemoveButton
          variant="ghost"
          className="ms-auto text-destructive"
          title={t("admin.remove_title")}
          onConfirm={() =>
            remove.mutate(listing.id, settle(t("admin.listing_removed")))
          }
        >
          {t("common.remove")}
        </RemoveButton>
      )}
    </>
  )

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={t("admin.listing_sheet_title")}
        footer={footer || undefined}
      >
        {missing ? (
          <p className="text-body text-muted-foreground">
            {t("admin.listing_not_found")}
          </p>
        ) : !listing ? (
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-24" />
            <Skeleton className="aspect-[4/3]" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ListingControls
              listing={listing}
              onStatus={(status) =>
                update.mutate(
                  { id: listing.id, status },
                  settle(t("admin.status_saved"))
                )
              }
              onGrant={() => setDialog("grant")}
            />
            <ListingReview listing={listing} actions={null} />
          </div>
        )}
      </EntitySheet>
      {listing && (
        <>
          <ReasonDialog
            open={dialog === "reject"}
            onOpenChange={(next) => !next && setDialog(null)}
            title={t("admin.reject_title")}
            label={t("admin.reject_label")}
            confirmLabel={t("admin.reject")}
            chips={rejectChips.map((c) => t(`admin.reject_${c}`))}
            pending={reject.isPending}
            onConfirm={(reason) =>
              reject.mutate(
                { id: listing.id, reason },
                settle(t("admin.listing_rejected"))
              )
            }
          />
          <GrantPromotionDialog
            open={dialog === "grant"}
            onOpenChange={(next) => !next && setDialog(null)}
            pending={grant.isPending}
            onConfirm={(value) =>
              grant.mutate(
                { listingId: listing.id, ...value },
                settle(t("admin.promotion_granted"))
              )
            }
          />
        </>
      )}
    </>
  )
}
