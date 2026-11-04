import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { meQuery } from "@/features/auth/me-query"
import {
  statusOptions,
  type useListingActions,
} from "@/features/listings-manager/use-listing-actions"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { daysSince, type Attention } from "../attention"

// One listing and the one thing to do about it: edit and resubmit, edit while in review, renew, or change the status of a long reservation.
export function AttentionRow({
  listing,
  reason,
  actions,
}: {
  listing: Listing
  reason: Attention
  actions: ReturnType<typeof useListingActions>
}) {
  const { t, locale } = useT()
  const now = useNow()
  const dealer = useQuery(meQuery).data?.role === "dealership"
  const note = {
    pending: t("status.pending"),
    rejected: listing.rejectionReason
      ? t("manager.reason", { reason: `⁨${listing.rejectionReason}⁩` })
      : t("manager.no_reason"),
    expiring: t(
      Date.parse(listing.expiresAt) <= now
        ? "dashboard.overview_expired"
        : "dashboard.overview_expiring",
      { when: formatRelative(listing.expiresAt, now, locale) }
    ),
    reserved: t("dashboard.overview_reserved", {
      count: daysSince(listing.updatedAt, now),
    }),
  }[reason]
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-ui font-medium">
          <bdi>{listing.title}</bdi>
        </p>
        <p className="text-caption text-muted-foreground">{note}</p>
      </div>
      {(reason === "rejected" || reason === "pending") && (
        <Link
          // A dealership edits on its own wizard route, everyone else on /post.
          {...(dealer
            ? {
                to: "/$locale/dealer/inventory/$id/edit",
                params: { locale, id: listing.id },
              }
            : {
                to: "/$locale/post",
                params: { locale },
                search: { edit: listing.id },
              })}
          // `cn` drops the base `border-transparent`, which would otherwise hide the outline border on a link.
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t(
            reason === "rejected"
              ? "dashboard.overview_edit_resubmit"
              : "common.edit"
          )}
        </Link>
      )}
      {reason === "expiring" && (
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.renew(listing)}
        >
          {t("manager.action_renew")}
        </Button>
      )}
      {reason === "reserved" && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            {t("dashboard.overview_update_status")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {statusOptions(listing)
              .filter((s) => s !== listing.status)
              .map((s) => (
                <DropdownMenuItem
                  key={s}
                  className="min-h-11 md:min-h-10"
                  onClick={() => actions.setStatus(listing, s)}
                >
                  {t(`status.${s}`)}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}
