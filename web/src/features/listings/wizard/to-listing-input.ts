import type { FieldValues } from "react-hook-form"
import type { z } from "zod"

import type { listingCreateSchema } from "@sayaratak/shared/schemas/inputs"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import {
  listingInputSchema,
  type ListingInput,
} from "@sayaratak/shared/listings/schemas"
import { applies } from "./field-rules"
import { wizardDefaults } from "./wizard-defaults"

export type ListingBody = z.input<typeof listingCreateSchema>

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : value

// The form values as the flat payload: every field of the wizard, a field that does not apply to the kind and type back to its empty value (the same table the details step reads), blank text as `null`.
const flatValues = (values: FieldValues) => {
  const all: FieldValues = { ...wizardDefaults, ...values }
  const out: FieldValues = {}
  for (const [field, empty] of Object.entries(wizardDefaults))
    out[field] = clean(applies(field, all) ? (all[field] ?? empty) : empty)
  return out
}
export const toFlatInput = (values: FieldValues): ListingInput =>
  listingInputSchema.parse(flatValues(values))

// The body of `POST /listings` (and of `PATCH /listings/:id` when editing). `submit` false keeps it a draft.
export function toListingInput(
  values: FieldValues,
  submit = true
): ListingBody {
  const { phone, whatsapp, showPhone, methods, ...rest } = toFlatInput(values)
  return { ...rest, contact: { phone, whatsapp, showPhone, methods }, submit }
}

// A listing as the form values of the wizard, for editing. The description is stored in both languages, so the one the person reads is the one shown.
export function listingToValues(l: Listing, locale: Locale): FieldValues {
  const source: Record<string, unknown> = {
    ...l,
    ...l.contact,
    description: l.description[locale] || l.description.en || l.description.ar,
  }
  const out: FieldValues = {}
  for (const [field, empty] of Object.entries(wizardDefaults))
    out[field] = source[field] ?? empty
  return out
}

// What the review step shows the owner: the card and the specs of the listing as it will look. `null` while the values are not a complete listing, which is only the instant before the wizard sends the person back to the step that is missing something.
export function draftListing(
  values: FieldValues,
  owner: Listing["owner"]
): Listing | null {
  const flat = listingInputSchema.safeParse(flatValues(values))
  if (!flat.success) return null
  const { phone, whatsapp, showPhone, methods, description, ...rest } =
    flat.data
  const now = new Date().toISOString()
  return {
    ...rest,
    id: "draft",
    slug: "draft",
    description: { ar: description, en: description },
    status: "available",
    moderation: "draft",
    rejectionReason: null,
    promotions: [],
    owner,
    contact: { phone, whatsapp, showPhone, methods },
    stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
    createdAt: now,
    updatedAt: now,
    expiresAt: now,
  }
}
