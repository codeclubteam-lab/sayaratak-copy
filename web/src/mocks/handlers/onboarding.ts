import { z } from "zod"

import { defaultWeeklyHours } from "@/lib/hours"
import {
  geoSchema,
  phoneSchema,
  weeklyHoursSchema,
} from "@sayaratak/shared/schemas/fields"
import { onboardingInputSchema } from "@sayaratak/shared/schemas/inputs"
import { interestSchema } from "@sayaratak/shared/schemas/user"
import { DAY, both, ratingFrom, slugify } from "@/mocks/seed/util"

import { db, newId } from "../db"
import { needUser, route } from "../http"
import { freePlanOf, nowIso, publicUser } from "../lib"
import { template } from "./uploads"

const phoneRows = z.array(z.object({ value: phoneSchema }))
const serviceRows = z.array(
  z.object({
    name: z.string(),
    priceFrom: z.number().int().nullable(),
    templateId: z.string().nullable().catch(null),
  })
)

// Creates the business record for the chosen role and ends onboarding. The forms validate before they post, so a missing or malformed field falls back to a default here.
route("POST", "/onboarding/complete", async (c) => {
  const user = needUser(c)
  const { role, payload } = await c.body(onboardingInputSchema)
  const get = <T>(schema: z.ZodType<T>, key: string) =>
    schema.safeParse(payload[key]).data
  const text = (k: string, fallback = "") => get(z.string(), k) ?? fallback
  const image = (k: string) => (text(k) ? template(text(k)) : "")
  const city = text("cityId", user.cityId ?? "khartoum")
  const district =
    db.taxonomy.districts.find((d) => d.id === text("districtId")) ??
    db.taxonomy.districts.find((d) => d.cityId === city)
  const phone = text("phone", user.phone ?? "+249900000000")
  const name = text("name", user.fullName)
  const base = {
    ownerId: user.id,
    slug: `${slugify(name) || "business"}-${user.id.slice(-4)}`,
    name: both(name),
    cityId: city,
    createdAt: nowIso(),
    rating: ratingFrom([]),
    verified: false,
    status: "active" as const,
  }
  const place = {
    districtId: district?.id ?? "",
    address: text("address"),
    location: get(geoSchema, "location") ?? null,
    hours: get(weeklyHoursSchema, "hours") ?? defaultWeeklyHours,
  }
  const whatsapp = get(phoneSchema, "whatsapp") ?? null
  if (role === "dealership") {
    const phones = get(phoneRows, "phones")?.map((p) => p.value)
    db.dealerships.push({
      ...base,
      id: newId("d"),
      logoUrl: image("logoId"),
      coverUrl: image("coverId"),
      description: both(text("description")),
      phones: phones?.length ? phones : [phone],
      whatsapp,
      inventoryCount: 0,
      ...place,
    })
  }
  if (role === "workshop") {
    const services = get(serviceRows, "services") ?? []
    db.workshops.push({
      ...base,
      id: newId("w"),
      logoUrl: image("logoId"),
      coverUrl: image("coverId"),
      description: both(text("description")),
      phone,
      whatsapp,
      images: [],
      services: services.map((s) => ({
        id: newId("svc"),
        name: s.name,
        description: "",
        templateId: s.templateId,
        ...(s.priceFrom ? { priceFrom: s.priceFrom } : {}),
      })),
      ...place,
    })
  }
  if (role === "mechanic")
    db.mechanics.push({
      ...base,
      id: newId("m"),
      photoUrl: image("photoId"),
      bio: both(text("bio")),
      servedCityIds: [
        ...new Set([
          city,
          ...(get(z.array(z.string()), "servedCityIds") ?? []),
        ]),
      ],
      yearsOfExperience: get(z.number().int().min(0), "yearsOfExperience") ?? 0,
      specializationIds: (
        get(z.array(z.string()), "specializationIds") ?? []
      ).filter((id) => db.taxonomy.specializations.some((s) => s.id === id)),
      phone,
      whatsapp,
      portfolio: [],
      available: true,
    })
  if (role === "user") {
    user.fullName = text("fullName", user.fullName)
    if (text("avatarId")) user.avatarUrl = template(text("avatarId"))
    user.interests = interestSchema.array().catch([]).parse(payload.interests)
  }
  // A business starts on the free plan of its audience; a paid choice is paid for afterwards.
  const free = role === "user" ? undefined : freePlanOf(role)
  if (free) {
    for (const s of db.subscriptions)
      if (s.userId === user.id && s.status === "active") s.status = "canceled"
    db.subscriptions.push({
      id: newId("sub"),
      userId: user.id,
      planId: free.id,
      status: "active",
      startsAt: nowIso(),
      endsAt: new Date(Date.now() + free.durationDays * DAY).toISOString(),
      price: free.price,
      usage: { used: 0, limit: free.listingLimit ?? null },
    })
  }
  const chosen = db.plans.find(
    (p) => p.id === payload.planId && p.audience === role && p.price > 0
  )
  user.chosenPlanId = chosen?.id
  user.role = role
  user.cityId = city
  user.onboardingDone = true
  return publicUser(user)
})
