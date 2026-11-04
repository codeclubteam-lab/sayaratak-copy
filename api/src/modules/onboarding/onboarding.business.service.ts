import {
  geoSchema,
  phoneSchema,
  weeklyHoursSchema,
} from "@sayaratak/shared/schemas/fields"
import { z } from "zod"

import { fail } from "~/shared/http/errors"
import { toFields } from "~/shared/http/validate"
import { DEFAULT_HOURS } from "~/shared/time/hours"
import type { NewBusiness } from "~/modules/businesses/businesses.types"
import type { SessionUser } from "~/modules/auth/auth.types"

export type BusinessRole = "dealership" | "workshop" | "mechanic"
/** Upload ids the owner picked, already attached; `null` when none. */
export type Pictures = {
  logo: string | null
  cover: string | null
  photo: string | null
}
type Account = { user: SessionUser; pictures: Pictures }

// The limits of the web's onboarding steps (`features/onboarding/schemas.ts`).
const NAME_MAX = 80
const DESCRIPTION_MAX = 1000
const BIO_MAX = 600
const ADDRESS_MAX = 160
const PHONES_MAX = 3
const SERVICES_MAX = 10
const SERVICE_NAME_MAX = 80
const PRICE_MAX = 9_999_999_999
const SERVED_CITIES_MAX = 5
const SKILLS_MAX = 6
const YEARS_MAX = 60

const text = (max: number) => z.string().trim().max(max, "validation.too_long")
const name = text(NAME_MAX).min(1, "validation.required")
const whatsapp = phoneSchema.or(z.literal(""))

const basics = {
  name: name.optional(),
  cityId: z.string().min(1, "validation.required").optional(),
  phone: phoneSchema.optional(),
  whatsapp: whatsapp.optional(),
}
const place = {
  districtId: z.string().optional(),
  address: text(ADDRESS_MAX).optional(),
  location: geoSchema.nullish(),
  hours: weeklyHoursSchema.optional(),
  description: text(DESCRIPTION_MAX).optional(),
}
const dealershipPayload = z.object({
  ...basics,
  ...place,
  phones: z
    .array(z.object({ value: phoneSchema }))
    .max(PHONES_MAX, "validation.too_long")
    .optional(),
})
const workshopPayload = z.object({
  ...basics,
  ...place,
  services: z
    .array(
      z.object({
        name: text(SERVICE_NAME_MAX).min(1, "validation.required"),
        priceFrom: z
          .number()
          .int()
          .min(1, "validation.price_min")
          .max(PRICE_MAX)
          .nullable()
          .default(null),
        templateId: z.string().nullable().default(null),
      })
    )
    .max(SERVICES_MAX, "validation.too_long")
    .optional(),
})
const mechanicPayload = z.object({
  ...basics,
  bio: text(BIO_MAX).optional(),
  servedCityIds: z.array(z.string()).max(SERVED_CITIES_MAX).optional(),
  specializationIds: z.array(z.string()).max(SKILLS_MAX).optional(),
  yearsOfExperience: z.number().int().min(0).max(YEARS_MAX).optional(),
})

/**
 * Turns the flat onboarding payload of a dealership, workshop or mechanic
 * into the profile to create. The web's forms validate first, so a missing
 * field takes the account's value (name, city, phone) or an empty one; a
 * field that is present and wrong is 422 `validation`, which the mock never
 * says. Example: `{ name: "Al Nour", cityId: "khartoum", phone: "+249912345678" }`
 * is a dealership with one phone, default hours and no pin.
 */
export function readBusiness(
  role: BusinessRole,
  payload: Record<string, unknown>,
  account: Account
): NewBusiness {
  if (role === "dealership") return readDealership(payload, account)
  if (role === "workshop") return readWorkshop(payload, account)
  return readMechanic(payload, account)
}

function readDealership(
  payload: Record<string, unknown>,
  account: Account
): NewBusiness {
  const form = parse(dealershipPayload, payload)
  const phones = form.phones?.map((row) => row.value) ?? []
  const phone = form.phone ?? account.user.phone
  if (phones.length === 0 && !phone)
    fail.validation({ phones: "validation.phone_min" })
  return {
    kind: "dealership",
    ...basicsOf(form, account),
    ...placeOf(form, account),
    phones: phones.length > 0 ? phones : [phone ?? ""],
  }
}

function readWorkshop(
  payload: Record<string, unknown>,
  account: Account
): NewBusiness {
  const form = parse(workshopPayload, payload)
  return {
    kind: "workshop",
    ...basicsOf(form, account),
    ...placeOf(form, account),
    phone: phoneOf(form, account.user),
    services: (form.services ?? []).map((service) => ({
      ...service,
      description: "",
    })),
  }
}

function readMechanic(
  payload: Record<string, unknown>,
  account: Account
): NewBusiness {
  const form = parse(mechanicPayload, payload)
  return {
    kind: "mechanic",
    ...basicsOf(form, account),
    phone: phoneOf(form, account.user),
    bio: form.bio ?? "",
    photoUploadId: account.pictures.photo,
    yearsOfExperience: form.yearsOfExperience ?? 0,
    servedCityIds: form.servedCityIds ?? [],
    specializationIds: form.specializationIds ?? [],
  }
}

type Basics = { name?: string; cityId?: string; whatsapp?: string }

function basicsOf(form: Basics, account: { user: SessionUser }) {
  const cityId = form.cityId ?? account.user.cityId
  if (!cityId) fail.validation({ cityId: "validation.required" })
  return {
    ownerUserId: account.user.id,
    name: form.name ?? account.user.name,
    cityId,
    whatsapp: form.whatsapp || null,
  }
}

type PlaceForm = {
  districtId?: string
  address?: string
  location?: { lat: number; lng: number } | null
  hours?: NonNullable<z.infer<typeof place.hours>>
  description?: string
}

function placeOf(form: PlaceForm, account: { pictures: Pictures }) {
  return {
    districtId: form.districtId || null,
    address: form.address ?? "",
    location: form.location ?? null,
    hours: form.hours ?? DEFAULT_HOURS,
    description: form.description ?? "",
    logoUploadId: account.pictures.logo,
    coverUploadId: account.pictures.cover,
  }
}

// A business with no phone cannot be called: the account's own number or a 422.
function phoneOf(form: { phone?: string }, user: SessionUser) {
  const phone = form.phone ?? user.phone
  if (!phone) fail.validation({ phone: "validation.required" })
  return phone
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) fail.validation(toFields(parsed.error))
  return parsed.data
}
