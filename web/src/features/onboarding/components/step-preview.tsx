import { useWatch } from "react-hook-form"
import { z } from "zod"

import { ProfilePreview } from "@/components/app/profile-preview"
import { weeklyHoursSchema } from "@sayaratak/shared/schemas/fields"
import { flatValues, type DraftData } from "../draft"
import type { FlowStep } from "../flows"
import { uploadTemplate } from "../media"
import type { OnboardingRole } from "../schemas"

// Half-typed values must never break the preview, so every field falls back to empty.
const previewSchema = z.object({
  name: z.string().catch(""),
  logoId: z.string().optional().catch(undefined),
  photoId: z.string().optional().catch(undefined),
  coverId: z.string().optional().catch(undefined),
  cityId: z.string().optional().catch(undefined),
  hours: weeklyHoursSchema.optional().catch(undefined),
})

const imageUrl = (id?: string) => (id ? uploadTemplate(id) : undefined)

// The saved steps plus what is being typed in the current one.
export function StepPreview({
  role,
  steps,
  stepId,
  data,
}: {
  role: Exclude<OnboardingRole, "user">
  steps: FlowStep[]
  stepId: string
  data: DraftData
}) {
  const live = useWatch()
  const all = previewSchema.parse(
    flatValues(steps, { ...data, [stepId]: live })
  )
  return (
    <ProfilePreview
      variant={role}
      name={all.name}
      imageUrl={imageUrl(all.logoId ?? all.photoId)}
      coverUrl={imageUrl(all.coverId)}
      cityId={all.cityId}
      hours={all.hours}
    />
  )
}
