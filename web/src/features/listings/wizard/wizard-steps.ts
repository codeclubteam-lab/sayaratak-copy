import { z } from "zod"

import {
  contactStepSchema,
  detailsSchema,
  photosStepSchema,
  reviewProfileSchema,
  typeStepSchema,
} from "@sayaratak/shared/listings/schemas"
import { ContactStep } from "./contact-step"
import { DetailsStep } from "./details-step"
import { PhotosStep } from "./photos-step"
import { ReviewStep } from "./review-step"
import { TypeStep } from "./type-step"
import type { WizardStep } from "./wizard-config"

// The steps of the post wizard, in order. `done` is not one of them: it opens after a successful publish.
export const wizardSteps: WizardStep[] = [
  {
    id: "type",
    labelKey: "post.step_type",
    titleKey: "post.type_title",
    Component: TypeStep,
    schema: () => typeStepSchema,
  },
  {
    id: "details",
    labelKey: "post.step_details",
    titleKey: "post.details_title",
    Component: DetailsStep,
    schema: ({ kind, vehicleType, intent }) =>
      detailsSchema({ kind, vehicleType, intent }),
  },
  {
    id: "photos",
    labelKey: "post.step_photos",
    titleKey: "post.photos_title",
    Component: PhotosStep,
    schema: () => photosStepSchema,
  },
  {
    id: "contact",
    labelKey: "post.step_contact",
    titleKey: "post.contact_title",
    Component: ContactStep,
    schema: () => contactStepSchema,
  },
  {
    id: "review",
    labelKey: "post.step_review",
    titleKey: "post.review_title",
    helperKey: "post.review_helper",
    Component: ReviewStep,
    schema: ({ profileName }) =>
      profileName === undefined ? z.object({}) : reviewProfileSchema,
  },
]
