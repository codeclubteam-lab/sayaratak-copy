import { extraDefaults } from "@sayaratak/shared/schemas/listing-fields"
import { expect, it } from "vitest"
import type { z } from "zod"

import { slugify } from "@sayaratak/shared/lib/slug"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import {
  taxonomyCreateSchemas,
  taxonomyPatchSchemas,
} from "@sayaratak/shared/schemas/taxonomy-inputs"
import {
  backupSchema,
  bannerSchema,
  reportSchema,
  settingsSchema,
  sitePageSchema,
  verificationRequestSchema,
} from "@sayaratak/shared/schemas/admin"
import {
  paymentSchema,
  planSchema,
  promotionPriceSchema,
  promotionSchema,
  subscriptionSchema,
} from "@sayaratak/shared/schemas/billing"
import {
  identifierSchema,
  passwordSchema,
  phoneSchema,
  priceSchema,
  weeklyHoursSchema,
} from "@sayaratak/shared/schemas/fields"
import {
  listingPageSchema,
  listingSchema,
} from "@sayaratak/shared/schemas/listing"
import {
  messageSchema,
  notificationSchema,
  threadSchema,
} from "@sayaratak/shared/schemas/messaging"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { userSchema } from "@sayaratak/shared/schemas/user"

const t = "2026-10-04T10:00:00.000Z"
const bi = { ar: "ب", en: "b" }
const geo = { lat: 15.5, lng: 32.5 }
const phone = "+249912345678"
const hours = Array.from({ length: 7 }, (_, day) => ({
  day,
  closed: false,
  open: "08:00",
  close: "18:00",
}))
const rating = { avg: 4.5, count: 10, distribution: [0, 0, 1, 4, 5] }
const media = {
  id: "m1",
  type: "image",
  url: "/mock/cars/car-01-{w}.webp",
  width: 1280,
  height: 960,
  placeholderColor: "#8a9a90",
  posterUrl: null,
}

const listing = {
  id: "k3f9a2",
  slug: "toyota-hilux-2019-khartoum-k3f9a2",
  kind: "vehicle",
  intent: "sale",
  vehicleType: "truck",
  title: "Toyota Hilux 2019",
  description: bi,
  price: 4500000,
  negotiable: true,
  rentPeriod: null,
  condition: "used",
  makeId: "toyota",
  modelId: "hilux",
  makeOther: null,
  modelOther: null,
  year: 2019,
  mileageKm: 120000,
  fuel: "diesel",
  transmission: "manual",
  color: null,
  engineCc: null,
  payloadTons: null,
  partNumber: null,
  ...extraDefaults,
  partCategoryId: null,
  compatibleTypes: [],
  media: [media],
  cityId: "khartoum",
  districtId: null,
  location: geo,
  status: "available",
  moderation: "approved",
  rejectionReason: null,
  promotions: [{ type: "featured", startsAt: t, endsAt: t }],
  owner: {
    id: "u1",
    type: "user",
    name: bi,
    avatarUrl: null,
    verified: false,
    memberSince: t,
    profileSlug: null,
  },
  contact: { phone, whatsapp: null, showPhone: true, methods: ["call"] },
  stats: { views: 1, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
  createdAt: t,
  updatedAt: t,
  expiresAt: t,
}
const facets = { type: [], make: [], fuel: [], transmission: [], city: [] }
const business = {
  id: "d1",
  slug: "d",
  ownerId: "u1",
  name: bi,
  logoUrl: "/l.webp",
  description: bi,
  cityId: "khartoum",
  districtId: "x",
  address: "A",
  location: null,
  whatsapp: null,
  hours,
  rating,
  verified: true,
  status: "active",
  createdAt: t,
}

const cases: [string, z.ZodType, unknown][] = [
  ["listing", listingSchema, listing],
  [
    "listing page",
    listingPageSchema,
    { items: [listing], total: 1, page: 1, pageSize: 24, facets },
  ],
  [
    "taxonomy",
    taxonomySchema,
    {
      cities: [{ id: "c", slug: "c", name: bi, countryId: "sd", center: geo }],
      districts: [{ id: "d", cityId: "c", name: bi }],
      makes: [{ id: "m", slug: "m", name: bi, vehicleTypes: ["car"] }],
      models: [{ id: "x", makeId: "m", name: bi }],
      vehicleTypes: [{ id: "car", name: bi, enabled: true }],
      partCategories: [{ id: "p", slug: "p", name: bi }],
      specializations: [{ id: "s", name: bi }],
      serviceTemplates: [{ id: "t", name: bi }],
    },
  ],
  [
    "user",
    userSchema,
    {
      id: "u1",
      role: "user",
      fullName: "A",
      verifiedPhone: false,
      verifiedEmail: false,
      hasPassword: true,
      banned: false,
      createdAt: t,
      onboardingDone: false,
      interests: ["cars"],
    },
  ],
  [
    "dealership",
    dealershipSchema,
    { ...business, coverUrl: "/c.webp", phones: [phone], inventoryCount: 3 },
  ],
  [
    "workshop",
    workshopSchema,
    {
      ...business,
      phone,
      images: [media],
      services: [{ id: "s", name: "Oil", description: "D", templateId: null }],
    },
  ],
  [
    "mechanic",
    mechanicSchema,
    {
      id: "m1",
      slug: "m",
      ownerId: "u1",
      name: bi,
      photoUrl: "/p.webp",
      bio: bi,
      cityId: "c",
      servedCityIds: ["c"],
      yearsOfExperience: 5,
      specializationIds: ["s"],
      phone,
      whatsapp: null,
      portfolio: [
        {
          id: "p",
          url: "/p.webp",
          caption: "C",
          width: 1,
          height: 1,
          placeholderColor: "#fff",
        },
      ],
      available: true,
      rating,
      verified: false,
      status: "active",
      createdAt: t,
    },
  ],
  [
    "review",
    reviewSchema,
    {
      id: "r1",
      targetType: "workshop",
      targetId: "w1",
      authorId: "u1",
      authorName: "A",
      rating: 5,
      createdAt: t,
      status: "visible",
    },
  ],
  [
    "thread",
    threadSchema,
    {
      id: "th1",
      subjectType: "listing",
      subjectId: "k3f9a2",
      subjectTitle: bi,
      participants: [{ id: "u1", name: "A", avatarUrl: null }],
      lastMessage: { body: "Hi", createdAt: t, senderId: "u1" },
      unreadCount: 0,
    },
  ],
  [
    "message",
    messageSchema,
    { id: "ms1", threadId: "th1", senderId: "u1", body: "Hi", createdAt: t },
  ],
  [
    "notification",
    notificationSchema,
    { id: "n1", type: "broadcast", title: bi, body: bi, createdAt: t },
  ],
  [
    "saved search",
    savedSearchSchema,
    {
      id: "s1",
      name: "Hilux",
      params: { kind: "vehicle", includeSold: false, sort: "newest", page: 1 },
      alerts: true,
      newCount: 2,
      createdAt: t,
    },
  ],
  [
    "plan",
    planSchema,
    {
      id: "p1",
      audience: "dealership",
      name: bi,
      price: 50000,
      durationDays: 30,
      features: [bi],
      enabled: true,
      sortOrder: 1,
    },
  ],
  [
    "subscription",
    subscriptionSchema,
    {
      id: "sub1",
      userId: "u1",
      planId: "p1",
      status: "active",
      startsAt: t,
      endsAt: t,
      price: 0,
      usage: { used: 1, limit: null },
    },
  ],
  [
    "payment",
    paymentSchema,
    {
      id: "pay1",
      userId: "u1",
      itemType: "plan",
      itemId: "p1",
      itemLabel: bi,
      amount: 50000,
      method: "bankak_transfer",
      reference: "R",
      payerName: "Omar",
      transactionRef: "T123",
      receiptUrl: "/r.webp",
      status: "pending_review",
      createdAt: t,
    },
  ],
  [
    "promotion",
    promotionSchema,
    {
      id: "pr1",
      listingId: "k3f9a2",
      type: "featured",
      status: "active",
      durationDays: 3,
      startsAt: t,
      endsAt: t,
      source: "paid",
    },
  ],
  [
    "promotion price",
    promotionPriceSchema,
    { id: "featured-7", type: "featured", durationDays: 7, price: 5000 },
  ],
  [
    "banner",
    bannerSchema,
    {
      id: "b1",
      title: "T",
      imageUrl: bi,
      href: "/ar",
      placement: "home_top",
      startsAt: t,
      endsAt: t,
      active: true,
      sortOrder: 1,
      impressions: 0,
      clicks: 0,
    },
  ],
  [
    "report",
    reportSchema,
    {
      id: "rp1",
      listingId: "k3f9a2",
      reporterId: "u1",
      reason: "scam",
      status: "open",
      createdAt: t,
    },
  ],
  [
    "verification request",
    verificationRequestSchema,
    {
      id: "v1",
      targetType: "dealership",
      targetId: "d1",
      ownerId: "u1",
      documents: [{ id: "d", label: "L", url: "/d.pdf" }],
      status: "pending",
      createdAt: t,
    },
  ],
  [
    "site page",
    sitePageSchema,
    { slug: "about", title: bi, body: bi, updatedAt: t },
  ],
  [
    "settings",
    settingsSchema,
    {
      autoApproveVerifiedDealers: false,
      listingExpiryDays: 60,
      individualSubscriptionsEnabled: false,
      freeListingLimit: 3,
      bankakAccount: { name: "N", number: "123456" },
      contact: { phone, whatsapp: phone, email: "a@b.co", address: "A" },
      locales: ["ar", "en"],
      backupSchedule: "off",
    },
  ],
  [
    "backup",
    backupSchema,
    { id: "bk1", createdAt: t, sizeMb: 12.5, type: "auto", status: "ready" },
  ],
]

it.each(cases)("parses a minimal valid %s", (_name, schema, value) => {
  expect(schema.safeParse(value).error?.issues).toBeUndefined()
})

it("rejects a listing with no contact method", () => {
  const bad = { ...listing, contact: { ...listing.contact, methods: [] } }
  expect(listingSchema.safeParse(bad).success).toBe(false)
})

it("search params fill defaults and drop bad values", () => {
  expect(searchParamsSchema.parse({})).toEqual({
    kind: "vehicle",
    includeSold: false,
    sort: "relevance",
    page: 1,
  })
  const parsed = searchParamsSchema.parse({
    type: "boat",
    radius: "7",
    page: "0",
    minPrice: "100",
    sort: "x",
  })
  expect(parsed).toMatchObject({
    type: undefined,
    radius: undefined,
    page: 1,
    minPrice: 100,
    sort: "relevance",
  })
})

it("field schemas return i18n keys as messages", () => {
  const msg = (s: z.ZodType, v: unknown) =>
    s.safeParse(v).error?.issues[0]?.message
  expect(phoneSchema.safeParse(phone).success).toBe(true)
  expect(msg(phoneSchema, "0912345678")).toBe("validation.phone")
  expect(identifierSchema.safeParse("٠٩١٢٣٤٥٦٧٨").success).toBe(true)
  expect(identifierSchema.safeParse("A@B.com").success).toBe(true)
  expect(msg(identifierSchema, "abc")).toBe("validation.identifier")
  expect(msg(passwordSchema, "abc")).toBe("validation.password_min")
  expect(msg(passwordSchema, "12345678")).toBe("validation.password_letter")
  expect(msg(priceSchema, null)).toBe("validation.required")
  expect(msg(priceSchema, 0)).toBe("validation.price_min")
  expect(msg(priceSchema, 1.5)).toBe("validation.integer")
  const reversed = [
    { day: 0, closed: false, open: "18:00", close: "08:00" },
    ...hours.slice(1),
  ]
  expect(msg(weeklyHoursSchema, reversed)).toBe("validation.hours_order")
})

it("taxonomy input schemas: create fixes the code, patch leaves fields out", () => {
  const name = { ar: "اسم", en: "Name" }
  expect(
    taxonomyCreateSchemas.countries.parse({
      code: "EG",
      name,
      dialCode: "+20",
      enabled: true,
    }).code
  ).toBe("eg")
  expect(
    taxonomyCreateSchemas.countries
      .safeParse({
        code: "egypt",
        name,
        dialCode: "20",
        enabled: true,
      })
      .error?.issues.map((i) => i.message)
  ).toEqual(["validation.country_code", "validation.dial_code"])
  expect(
    taxonomyCreateSchemas.makes.safeParse({ name, vehicleTypes: [] }).error
      ?.issues[0]?.message
  ).toBe("validation.select_min")
  // A slug cannot be sent: it is made once from the English name.
  expect(
    taxonomyCreateSchemas["part-categories"].parse({ name, slug: "x" })
  ).toEqual({ name })
  expect(taxonomyPatchSchemas.cities.parse({})).toEqual({})
  expect(
    taxonomyPatchSchemas.countries.parse({ code: "eg", enabled: false })
  ).toEqual({ enabled: false })
  expect(slugify("Land Cruiser Prado")).toBe("land-cruiser-prado")
  expect(slugify("تويوتا")).toBe("")
})
