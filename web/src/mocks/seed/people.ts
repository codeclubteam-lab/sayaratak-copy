import type { Interest } from "@sayaratak/shared/schemas/user"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"
import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import type { UserRow } from "../types"
import { businessMedia, businessPhoto } from "./photos"
import {
  DAY,
  ago,
  bilingualName,
  chance,
  defaultPrefs,
  int,
  jitter,
  joinPairs,
  pick,
  ratingFrom,
  roundTo,
  slugify,
} from "./util"
import {
  dealerDesc,
  dealerNames,
  familyNames,
  firstNames,
  mechanicBio,
  workshopDesc,
  workshopNames,
} from "./words"
import { faker } from "@faker-js/faker"

const interests: Interest[] = [
  "cars",
  "trucks",
  "motorcycles",
  "tuk_tuks",
  "parts",
  "workshops",
  "mechanics",
]
export const DEMO_PASSWORD = "Demo1234"

export const weeklyHours = (alt = false): WeeklyHours =>
  Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: day === 5,
    open: alt ? "09:00" : "08:00",
    close: alt ? "20:00" : "17:00",
  }))

const phone = () =>
  `+249${pick(["91", "92", "99", "90"])}${int(1_000_000, 9_999_999)}`
const personName = () =>
  `${pick(firstNames)} ${pick(firstNames.slice(0, 20))} ${pick(familyNames)}`

type Base = Omit<
  UserRow,
  | "createdAt"
  | "verifiedPhone"
  | "verifiedEmail"
  | "banned"
  | "onboardingDone"
  | "interests"
  | "locale"
  | "prefs"
  | "password"
> &
  Partial<UserRow>
const user = (b: Base): UserRow => ({
  verifiedPhone: Boolean(b.phone),
  verifiedEmail: Boolean(b.email),
  banned: false,
  onboardingDone: true,
  interests: [],
  locale: "ar",
  prefs: { ...defaultPrefs },
  password: DEMO_PASSWORD,
  createdAt: ago(int(30, 600) * DAY),
  ...b,
})

export function seedPeople(taxonomy: Taxonomy, empty: boolean) {
  const cities = taxonomy.cities
  const district = (cityId: string) =>
    pick(taxonomy.districts.filter((d) => d.cityId === cityId))
  const where = (cityId: string) => {
    const city = cities.find((c) => c.id === cityId) ?? cities[0]
    const d = district(cityId)
    return {
      cityId,
      districtId: d.id,
      address: `${d.name.ar}، ${city?.name.ar ?? ""}`,
      location: city
        ? { lat: jitter(city.center.lat), lng: jitter(city.center.lng) }
        : null,
    }
  }

  const users: UserRow[] = [
    user({
      id: "u-omar",
      role: "user",
      fullName: "Omar Hassan",
      email: "user@demo.sy",
      phone: "+249912345601",
      cityId: "khartoum",
      interests: ["cars", "parts"],
    }),
    user({
      id: "u-dealer",
      role: "dealership",
      fullName: "Al Nasr Motors",
      email: "dealer@demo.sy",
      cityId: "khartoum",
      phone: "+249912345602",
    }),
    user({
      id: "u-workshop",
      role: "workshop",
      fullName: "Al Amal Auto Care",
      email: "workshop@demo.sy",
      cityId: "omdurman",
      phone: "+249912345603",
    }),
    user({
      id: "u-mechanic",
      role: "mechanic",
      fullName: "Yousif Ibrahim",
      email: "mechanic@demo.sy",
      cityId: "bahri",
      phone: "+249912345604",
    }),
    user({
      id: "u-admin",
      role: "admin",
      fullName: "Site admin",
      email: "admin@demo.sy",
    }),
    user({
      id: "u-new",
      role: "user",
      fullName: "New Visitor",
      email: "new@demo.sy",
      onboardingDone: false,
    }),
  ]
  const individuals = empty ? 0 : 59
  for (let i = 1; i <= individuals; i++) {
    // Draw kept from when only some had an email, so the rest of the seeded data does not shift.
    chance(0.3)
    users.push(
      user({
        id: `u-${i}`,
        role: "user",
        fullName: personName(),
        phone: phone(),
        email: `user${i}@example.sy`,
        cityId: pick(cities).id,
        verifiedPhone: chance(0.85),
        interests: faker.helpers.arrayElements(interests, int(1, 3)),
        banned: i > individuals - 2,
        bannedReason:
          i > individuals - 2 ? "Repeated spam listings" : undefined,
      })
    )
  }
  const owner = (prefix: string, i: number, role: UserRow["role"]) => {
    const row = user({
      id: `${prefix}-${i}`,
      email: `${prefix}${i}@example.sy`,
      role,
      fullName: personName(),
      phone: phone(),
      cityId: pick(cities).id,
    })
    users.push(row)
    return row
  }

  const dealerCount = empty ? 1 : 12
  const dealerships: Dealership[] = dealerNames
    .slice(0, dealerCount)
    .map(([ar, en], i) => {
      const demo = i === 0
      const ownerRow = demo ? users[1] : owner("ud", i, "dealership")
      const cityId = demo ? "khartoum" : pick(cities).id
      return {
        id: `d-${i + 1}`,
        slug: slugify(en),
        ownerId: ownerRow?.id ?? "u-dealer",
        name: { ar, en },
        logoUrl: businessPhoto(i, 320),
        coverUrl: businessPhoto(i + 1, 1280),
        description: joinPairs(dealerDesc, int(2, 3)),
        ...where(cityId),
        phones: demo
          ? ["+249912345602"]
          : [phone(), ...(chance(0.5) ? [phone()] : [])],
        whatsapp:
          chance(0.7) || demo ? (demo ? "+249912345602" : phone()) : null,
        hours: weeklyHours(chance(0.4)),
        rating: ratingFrom([]),
        verified: demo || i < 8,
        inventoryCount: 0,
        status: i === 11 ? "suspended" : "active",
        createdAt: ago(int(60, 700) * DAY),
      }
    })

  const workshopCount = empty ? 1 : 14
  const workshops: Workshop[] = workshopNames
    .slice(0, workshopCount)
    .map(([ar, en], i) => {
      const demo = i === 0
      const ownerRow = demo ? users[2] : owner("uw", i, "workshop")
      const phoneNo = demo ? "+249912345603" : phone()
      return {
        id: `w-${i + 1}`,
        slug: slugify(en),
        ownerId: ownerRow?.id ?? "u-workshop",
        name: { ar, en },
        logoUrl: businessPhoto(i + 2, 320),
        coverUrl: businessPhoto(i + 3, 1280),
        description: joinPairs(workshopDesc, int(2, 3)),
        ...where(demo ? "omdurman" : pick(cities).id),
        phone: phoneNo,
        whatsapp: demo || chance(0.7) ? phoneNo : null,
        hours: weeklyHours(chance(0.3)),
        images: Array.from({ length: int(2, 4) }, (_, k) =>
          businessMedia(i * 5 + k)
        ),
        services: faker.helpers
          .arrayElements(taxonomy.serviceTemplates, int(3, 6))
          .map((s) => ({
            id: `${s.id}-${i}`,
            name: s.name.ar,
            description: s.name.en,
            priceFrom: roundTo(int(20_000, 400_000), 5000),
            templateId: s.id,
          })),
        rating: ratingFrom([]),
        verified: !demo && i < 10, // the demo workshop starts unverified (A9)
        status: "active",
        createdAt: ago(int(60, 700) * DAY),
      }
    })

  const mechanicCount = empty ? 1 : 18
  const mechanics: Mechanic[] = Array.from(
    { length: mechanicCount },
    (_, i) => {
      const demo = i === 0
      const ownerRow = demo ? users[3] : owner("um", i, "mechanic")
      const cityId = demo ? "bahri" : pick(cities).id
      const phoneNo = demo ? "+249912345604" : (ownerRow?.phone ?? phone())
      return {
        id: `m-${i + 1}`,
        slug: demo
          ? "yousif-ibrahim"
          : `${slugify(ownerRow?.id ?? "m")}-${i + 1}`,
        ownerId: ownerRow?.id ?? "u-mechanic",
        name: bilingualName(ownerRow?.fullName ?? ""),
        photoUrl: businessPhoto(i + 4, 320),
        bio: joinPairs(mechanicBio, int(1, 3)),
        cityId,
        servedCityIds: [
          ...new Set([
            cityId,
            ...faker.helpers.arrayElements(cities, int(0, 2)).map((c) => c.id),
          ]),
        ],
        yearsOfExperience: int(2, 25),
        specializationIds: faker.helpers
          .arrayElements(taxonomy.specializations, int(1, 3))
          .map((s) => s.id),
        phone: phoneNo,
        whatsapp: demo || chance(0.6) ? phoneNo : null,
        portfolio: Array.from({ length: int(2, 5) }, (__, k) => ({
          id: `pf-${i}-${k}`,
          url: businessMedia(i * 7 + k).url,
          caption: pick([
            "تغيير محرك",
            "صيانة ناقل الحركة",
            "إصلاح كهرباء",
            "تجديد تعليق",
            "فحص شامل",
          ]),
          width: 1280,
          height: 853,
          placeholderColor: "#c9d3cf",
        })),
        available: chance(0.75),
        rating: ratingFrom([]),
        verified: !demo && i < 11, // the demo mechanic starts unverified (A9)
        status: "active",
        createdAt: ago(int(60, 700) * DAY),
      }
    }
  )
  return { users, dealerships, workshops, mechanics }
}
