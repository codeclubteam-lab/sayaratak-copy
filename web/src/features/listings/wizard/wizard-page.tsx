import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { StatusBanner } from "../components/status-banner"
import { listingQueries } from "../queries"
import { DoneStep } from "./done-step"
import { ListingWizard } from "./listing-wizard"
import { listingToValues } from "./to-listing-input"
import { useListingLimit } from "./use-listing-limit"
import { usePublishListing } from "./use-publish-listing"
import { wizardDefaults } from "./wizard-defaults"
import { wizardSteps } from "./wizard-steps"

// The post wizard with its data: the listing being edited, Publish, the limit and the done step. `/post` and the two dealer inventory routes mount it; `onSaved` opens the done step on the route's own address.
export function WizardPage({
  context,
  step,
  editId,
  savedId,
  onSaved,
}: {
  context: "public" | "dealer"
  step: string
  editId?: string
  savedId?: string
  onSaved: (id: string) => void
}) {
  const { locale } = useT()
  const listing = useQuery({
    ...listingQueries.detail(editId ?? ""),
    enabled: !!editId,
  })
  if (listing.error) throw listing.error
  const base = useMemo(
    () =>
      listing.data && {
        values: listingToValues(listing.data, locale),
        updatedAt: listing.data.updatedAt,
      },
    [listing.data, locale]
  )
  const publish = usePublishListing({
    editId,
    onSaved: (saved) => onSaved(saved.id),
  })
  const { reached } = useListingLimit(!!editId)
  // `done` is not a wizard step: it shows the listing that was just saved, and nothing without one.
  if (step === "done") return <DoneStep context={context} listingId={savedId} />
  return (
    <ListingWizard
      context={context}
      stepId={step}
      steps={wizardSteps}
      editId={editId}
      base={base}
      defaultValues={wizardDefaults}
      publishDisabled={reached}
      banner={
        listing.data?.moderation === "rejected" && (
          <StatusBanner listing={listing.data} />
        )
      }
      onPublish={publish}
    />
  )
}
