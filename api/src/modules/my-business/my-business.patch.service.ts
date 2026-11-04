import {
  geoSchema,
  phoneSchema,
  weeklyHoursSchema,
} from "@sayaratak/shared/schemas/fields"
import { z } from "zod"

import { fail } from "~/shared/http/errors"
import { toFields } from "~/shared/http/validate"
import { both } from "~/shared/text/bilingual"
import type { BusinessKind } from "~/modules/businesses/businesses.types"
import type { Pictures } from "~/modules/businesses/businesses.update.service"

// The limits of the web's profile sections (`features/onboarding/schemas.ts`).
const NAME_MAX = 80
const DESCRIPTION_MAX = 1000
const BIO_MAX = 600
const ADDRESS_MAX = 160
const PHONES_MAX = 3
// Five served cities besides the home city, which the page sends first.
const SERVED_CITIES_MAX = 6
const SKILLS_MAX = 6
const YEARS_MAX = 60

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, "validation.required")
    .max(max, "validation.too_long")
// Typed once and stored in both languages, or sent as the two slots.
const words = (min: number, max: number) =>
  z.union([
    text(min, max),
    z.object({ ar: text(min, max), en: text(min, max) }),
  ])
const whatsapp = phoneSchema.or(z.literal("")).nullish()

const common = {
  name: words(1, NAME_MAX).optional(),
  cityId: z.string().min(1, "validation.required").optional(),
  whatsapp,
}
const place = {
  ...common,
  districtId: z.string().optional(),
  address: text(0, ADDRESS_MAX).optional(),
  location: geoSchema.nullable().optional(),
  hours: weeklyHoursSchema.optional(),
  description: words(0, DESCRIPTION_MAX).optional(),
  logoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
}
const SCHEMAS = {
  dealership: z.object({
    ...place,
    phones: z
      .array(phoneSchema)
      .min(1, "validation.phone_min")
      .max(PHONES_MAX, "validation.too_long")
      .optional(),
  }),
  workshop: z.object({ ...place, phone: phoneSchema.optional() }),
  mechanic: z.object({
    ...common,
    photoUrl: z.string().optional(),
    bio: words(0, BIO_MAX).optional(),
    phone: phoneSchema.optional(),
    yearsOfExperience: z.number().int().min(0).max(YEARS_MAX).optional(),
    servedCityIds: z.array(z.string()).max(SERVED_CITIES_MAX).optional(),
    specializationIds: z.array(z.string()).max(SKILLS_MAX).optional(),
    available: z.boolean().optional(),
  }),
}

type Form = Record<string, unknown> & {
  name?: string | { ar: string; en: string }
  description?: string | { ar: string; en: string }
  bio?: string | { ar: string; en: string }
  cityId?: string
  districtId?: string
  address?: string
  location?: { lat: number; lng: number } | null
  hours?: z.infer<typeof weeklyHoursSchema>
  whatsapp?: string | null
  phone?: string
  phones?: string[]
  yearsOfExperience?: number
  servedCityIds?: string[]
  specializationIds?: string[]
  available?: boolean
  logoUrl?: string
  coverUrl?: string
  photoUrl?: string
}

/**
 * Reads the body of `PATCH /me/business` for the kind of business the account
 * has: only the fields that kind edits count, the rest (slug, rating, services
 * and so on) is ignored. A field that is present and wrong is 422. Returns the
 * columns to set and the picture addresses to resolve.
 */
export function readPatch(kind: BusinessKind, body: Record<string, unknown>) {
  const parsed = SCHEMAS[kind].safeParse(body)
  if (!parsed.success) fail.validation(toFields(parsed.error))
  const form: Form = parsed.data
  const { logoUrl, coverUrl, photoUrl } = form
  const pictures: Pictures = {
    ...(logoUrl !== undefined && { logoUrl }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(photoUrl !== undefined && { photoUrl }),
  }
  return { form, pictures, kind }
}

const slots = (value: string | { ar: string; en: string }) =>
  typeof value === "string" ? both(value) : value

/** The columns a form changes; a field left out stays as it is. */
export function columnsOf(form: Form) {
  return {
    ...textColumns(form),
    ...placeColumns(form),
    ...contactColumns(form),
    ...mechanicColumns(form),
  }
}

function textColumns(form: Form) {
  return {
    ...(form.name !== undefined && { name: slots(form.name) }),
    ...(form.description !== undefined && {
      description: slots(form.description),
    }),
    ...(form.bio !== undefined && { bio: slots(form.bio) }),
  }
}

function placeColumns(form: Form) {
  const { cityId, districtId, address, location, hours } = form
  return {
    ...(cityId !== undefined && { cityId }),
    ...(districtId !== undefined && { districtId: districtId || null }),
    ...(address !== undefined && { address }),
    ...(location !== undefined && {
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    }),
    ...(hours !== undefined && { hours }),
  }
}

function contactColumns(form: Form) {
  const { whatsapp, phone, phones } = form
  return {
    ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
    ...(phone !== undefined && { phone }),
    ...(phones !== undefined && { phones }),
  }
}

function mechanicColumns(form: Form) {
  const { yearsOfExperience, available } = form
  return {
    ...(yearsOfExperience !== undefined && { yearsOfExperience }),
    ...(available !== undefined && { available }),
  }
}
