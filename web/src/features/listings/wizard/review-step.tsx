import { useEffect } from "react"
import { useFormContext } from "react-hook-form"

import { LimitMeter } from "@/components/app/limit-meter"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ProfileFields } from "./profile-fields"
import { ReviewBody } from "./review-body"
import { draftListing } from "./to-listing-input"
import { useListingLimit } from "./use-listing-limit"
import { useStepFields } from "./use-step-fields"

// Step `review`: the listing and what was entered (`ReviewBody`), the name and city of a new account, and the free limit. Publishing is the wizard footer's job.
export function ReviewStep({ editing }: { editing: boolean }) {
  const { t, locale } = useT()
  const { getValues, setValue, unregister } = useFormContext()
  const { values } = useStepFields()
  const { me, used, limit } = useListingLimit(editing)
  const needsProfile = !!me && !me.onboardingDone
  const owner: Listing["owner"] = {
    id: me?.id ?? "draft",
    type: "user",
    name: { ar: me?.fullName ?? "", en: me?.fullName ?? "" },
    avatarUrl: me?.avatarUrl ?? null,
    verified: me?.verifiedPhone ?? false,
    memberSince: me?.createdAt ?? new Date().toISOString(),
    profileSlug: null,
  }
  const listing = draftListing(values, owner)

  // The profile fields exist in the form only while they are shown, so the step's rules ask for them only then.
  useEffect(() => {
    if (!needsProfile) return unregister(["profileName", "profileCityId"])
    if (getValues("profileName") !== undefined) return
    setValue("profileName", me.fullName)
    setValue("profileCityId", getValues("cityId"))
  }, [needsProfile])

  if (!listing) return null
  return (
    <>
      <ReviewBody listing={listing} />
      {needsProfile && <ProfileFields />}
      {limit !== null && (
        <LimitMeter
          label={t("post.limit_label")}
          used={used}
          limit={limit}
          action={
            <a
              href={localeHref(`${dashboardPath(me?.role)}/billing`, locale)}
              className={buttonVariants({ variant: "link", size: "sm" })}
            >
              {t("post.limit_upgrade")}
            </a>
          }
        />
      )}
    </>
  )
}
