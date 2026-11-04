import { z } from "zod"

import { withRedirect } from "@/features/auth/destination"
import { localeHref } from "@/lib/navigation"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { FlowStep } from "./flows"

export type DraftData = Record<string, unknown>

const record = z.record(z.string(), z.unknown())

// What a step form starts with: the values saved for it, or nothing yet.
export function stepValues(data: DraftData, id: string) {
  const parsed = record.safeParse(data[id])
  return parsed.success ? parsed.data : {}
}

// Drafts hold form input, so a step counts as saved when that input still passes its schema.
const isSaved = (step: FlowStep, data: DraftData) =>
  step.id in data && step.schema.safeParse(data[step.id]).success

// A step opens only when every earlier required step is saved. With all saved, the last one.
export function reachableIndex(steps: FlowStep[], data: DraftData) {
  const open = steps.findIndex((s) => !s.optional && !isSaved(s, data))
  return open === -1 ? steps.length - 1 : open
}

// Every step's values in one flat object: the payload of `POST /onboarding/complete` and the source of the live preview.
export const flatValues = (steps: FlowStep[], data: DraftData) =>
  steps.reduce<DraftData>(
    (all, s) => ({ ...all, ...stepValues(data, s.id) }),
    {}
  )

export const stepHref = (
  role: string,
  step: string,
  locale: Locale,
  redirect?: string
) => localeHref(withRedirect(`/onboarding/${role}/${step}`, redirect), locale)
