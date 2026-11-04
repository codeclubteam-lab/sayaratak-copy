import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"

const tones = {
  reserved: "bg-warning/12 text-warning",
  pending: "bg-warning/12 text-warning",
  sold: "bg-muted text-muted-foreground",
  rented: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/12 text-destructive",
  removed: "bg-destructive/12 text-destructive",
}

// The reason is typed by an admin, maybe in the other language, so it goes in a first-strong isolate (U+2068 to U+2069) and cannot reorder the sentence around it.
// A template string, not cn(): cn() would read `text-ui` as a color and drop it.
// One full-width row: a review state (owner and admins only, the API 404s it for anyone else) wins over the sale state. The empty live region stays mounted, so a status change by the owner is announced.
export function StatusBanner({ listing }: { listing: Listing }) {
  const { t } = useT()
  const state =
    listing.moderation !== "approved"
      ? listing.moderation
      : listing.status === "available"
        ? null
        : listing.status
  return (
    <div role="status" data-slot="status-banner" className="empty:hidden">
      {state && (
        <p
          className={`rounded-lg px-4 py-3 text-ui font-medium ${tones[state]}`}
        >
          {state === "rejected"
            ? listing.rejectionReason
              ? t("listing.banner_rejected", {
                  reason: `\u2068${listing.rejectionReason}\u2069`,
                })
              : t("listing.banner_rejected_plain")
            : t(`listing.banner_${state}`)}
        </p>
      )}
    </div>
  )
}
