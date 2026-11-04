import { useQueryClient } from "@tanstack/react-query"
import type { FieldValues } from "react-hook-form"

import { meQuery } from "@/features/auth/me-query"
import { useRequireAuth } from "@/features/auth/auth-gate"
import { useCompleteOnboarding } from "@/features/onboarding/queries"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/lib/api/client"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { useCreateListing, useUpdateListing } from "../queries"
import { toListingInput } from "./to-listing-input"

// The `onPublish` of the post wizard. Signed out, Publish opens the auth dialog and runs again after sign in. A new account that has not given a name and city is first asked for them in the review step (`profileName`, `profileCityId`), then finishes onboarding as an individual without leaving the wizard. `editId` saves over that listing instead of creating one. Resolves `true` once saved, which tells the wizard to drop its draft.
export function usePublishListing({
  editId,
  onSaved,
}: {
  editId?: string
  onSaved: (listing: Listing) => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const requireAuth = useRequireAuth()
  const create = useCreateListing()
  const update = useUpdateListing(editId ?? "")
  const onboard = useCompleteOnboarding()

  const run = async (values: FieldValues) => {
    const me = qc.getQueryData(meQuery.queryKey)
    if (!me) return false
    if (!me.onboardingDone) {
      // Just signed in: the review shows the name and city fields now, and Publish is pressed again.
      if (values.profileName === undefined) return false
      await onboard.mutateAsync({
        role: "user",
        payload: { fullName: values.profileName, cityId: values.profileCityId },
      })
    }
    const body = toListingInput(values)
    const saved = editId
      ? await update.mutateAsync(body)
      : await create.mutateAsync(body)
    onSaved(saved)
    return true
  }

  return (values: FieldValues) => {
    let done: Promise<boolean> = Promise.resolve(false)
    requireAuth(() => {
      done = run(values).catch((error: unknown) => {
        toast.add({
          title:
            error instanceof ApiError && error.code === "limit_reached"
              ? t("billing.limit_reached")
              : errorText(t, error),
        })
        return false
      })
    }, "auth.reason_post")
    return done
  }
}
