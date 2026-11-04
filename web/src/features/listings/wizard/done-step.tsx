import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"

import { ShareMenu } from "@/components/app/share-menu"
import { StepHeader } from "@/components/app/step-header"
import { buttonVariants } from "@/components/ui/button"
import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { listingQueries } from "../queries"
import { PromotionOffer } from "./promotion-offer"
import { WizardLayout } from "./wizard-layout"

// What comes after Publish: the listing is live or waits for review, and what to do next. Only its owner may see it, and only for a listing that has just been saved (`pending` or `approved`); any other visit goes back to the first step of the wizard.
export function DoneStep({
  context,
  listingId,
}: {
  context: "public" | "dealer"
  listingId?: string
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const start = useRouterState({ select: (s) => s.location.pathname })
  const me = useQuery(meQuery)
  const user = me.data
  const asked = !!me.data && !!listingId
  const listing = useQuery({
    ...listingQueries.detail(listingId ?? ""),
    enabled: asked,
  })
  const [offerClosed, setOfferClosed] = useState(false)

  const row = listing.data
  const mine =
    !!user &&
    row?.owner.id === user.id &&
    (row.moderation === "approved" || row.moderation === "pending")
  const settled = !me.isPending && (!asked || !listing.isPending)
  useEffect(() => {
    if (settled && !mine) router.history.replace(start)
  }, [settled, mine])

  let content = null
  if (mine) {
    const live = row.moderation === "approved"
    const listings =
      context === "dealer" ? "/dealer/inventory" : "/account/listings"
    const link = (path: string) => localeHref(path, locale)
    content = (
      <>
        <StepHeader
          step="done"
          title={t(live ? "post.done_live_title" : "post.done_pending_title")}
          helper={t(
            live ? "post.done_live_helper" : "post.done_pending_helper"
          )}
        />
        <div className="flex flex-wrap gap-3">
          {live && (
            <a
              href={link(`/listing/${row.slug}`)}
              className={buttonVariants({ size: "lg" })}
            >
              {t("post.done_view")}
            </a>
          )}
          <a
            href={link(listings)}
            className={buttonVariants({
              size: "lg",
              variant: live ? "secondary" : "default",
            })}
          >
            {t("post.done_my_listings")}
          </a>
          <a
            href={start}
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            {t("post.done_another")}
          </a>
          {live && <ShareMenu listing={row} title={row.title} />}
        </div>
        {!live && (
          <p className="text-ui text-muted-foreground">
            {t("listing.promote_after_approval")}
          </p>
        )}
        {live && !offerClosed && (
          <PromotionOffer
            listingId={row.id}
            role={user.role}
            onSkip={() => setOfferClosed(true)}
          />
        )}
      </>
    )
  }
  return (
    <WizardLayout context={context} editing={false}>
      {content}
    </WizardLayout>
  )
}
