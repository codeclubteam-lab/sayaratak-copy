import { makeListingSlug } from "@sayaratak/shared/lib/slug"
import type {
  Fuel,
  Intent,
  ListingStatus,
  Media,
  Moderation,
  PromotionType,
  Transmission,
  VehicleType,
} from "@sayaratak/shared/schemas/listing"
import type { Promotion } from "@sayaratak/shared/schemas/billing"
import type { Dealership } from "@sayaratak/shared/schemas/profile"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import { faker } from "@faker-js/faker"
import type { ListingRow, UserRow } from "../types"
import { pickMockPhoto } from "./photos"
import { seedSpecs } from "./specs"
import type { CatalogModel } from "./taxonomy"
import { partCatalog } from "./taxonomy"
import {
  DAY,
  HOUR,
  ago,
  ahead,
  bilingualName,
  chance,
  int,
  jitter,
  pick,
  roundTo,
} from "./util"
import {
  colors,
  descClose,
  descCloseEn,
  descOpen,
  descOpenEn,
  descPartOpen,
  descPartOpenEn,
  descRentOpen,
  descRentOpenEn,
  traits,
} from "./words"

const fill = (tpl: string, v: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""))

type Plan = {
  kind: "vehicle" | "part"
  intent: Intent
  types: VehicleType[]
  n: number
}
const plans: Plan[] = [
  { kind: "vehicle", intent: "sale", types: ["car"], n: 140 },
  { kind: "vehicle", intent: "rent", types: ["car"], n: 40 },
  { kind: "vehicle", intent: "sale", types: ["truck"], n: 30 },
  { kind: "vehicle", intent: "sale", types: ["motorcycle"], n: 25 },
  { kind: "vehicle", intent: "sale", types: ["tuk_tuk", "rickshaw"], n: 25 },
  { kind: "part", intent: "sale", types: [], n: 40 },
]
const featuredDays = [3, 7, 14]

type Ctx = {
  taxonomy: Taxonomy
  catalog: CatalogModel[]
  users: UserRow[]
  dealerships: Dealership[]
}

export function seedListings(ctx: Ctx) {
  const { taxonomy, catalog, users, dealerships } = ctx
  const omar = users.find((u) => u.id === "u-omar")
  const individuals = users.filter(
    (u) =>
      u.id.startsWith("u-") &&
      u.role === "user" &&
      !u.banned &&
      u.phone &&
      u.id !== "u-omar"
  )
  const alNasr = dealerships[0]
  const otherDealers = dealerships.slice(1).filter((d) => d.status === "active")
  const popular = new Set(taxonomy.makes.slice(0, 20).map((m) => m.id))
  const listings: ListingRow[] = []
  const promotions: Promotion[] = []
  let counter = 0

  type Opts = {
    kind: "vehicle" | "part"
    intent: Intent
    type: VehicleType | null
    moderation: Moderation
    demoOnly?: boolean
  }
  function make({ kind, intent, type, moderation, demoOnly }: Opts) {
    const n = counter++
    const id = `l${(n + 1).toString(36).padStart(5, "0")}`
    const who = demoOnly
      ? pick(["omar", "nasr"] as const)
      : faker.helpers.weightedArrayElement([
          { weight: 10, value: "omar" as const },
          { weight: 18, value: "nasr" as const },
          { weight: otherDealers.length ? 25 : 0, value: "dealer" as const },
          { weight: 47, value: "person" as const },
        ])
    const dealer =
      who === "nasr"
        ? alNasr
        : who === "dealer"
          ? pick(otherDealers)
          : undefined
    const person =
      who === "omar"
        ? omar
        : pick(individuals.length ? individuals : users.slice(0, 1))
    const ownerUser = dealer
      ? users.find((u) => u.id === dealer.ownerId)
      : person
    const city = dealer ? dealer.cityId : (person?.cityId ?? "khartoum")
    const cityRow =
      taxonomy.cities.find((c) => c.id === city) ?? taxonomy.cities[0]
    const district = pick(taxonomy.districts.filter((d) => d.cityId === city))
    const lang = chance(0.2) ? "en" : "ar"

    let model: CatalogModel | undefined
    let year: number | null = null
    let mileage: number | null = null
    let fuel: Fuel | null = null
    let gear: Transmission | null = null
    let price = 0
    let title = ""
    let desc = { ar: "", en: "" }
    let partCategoryId: string | null = null
    let partMake: CatalogModel | undefined
    const used = !chance(0.06)
    const trait = pick(traits)
    if (kind === "vehicle" && type) {
      // The twenty makes that lead the taxonomy sell far more than the rest, so they get twelve times the weight.
      model = faker.helpers.weightedArrayElement(
        catalog
          .filter((m) => m.type === type)
          .map((value) => ({
            weight: popular.has(value.makeId) ? 12 : 1,
            value,
          }))
      )
      year =
        intent === "rent"
          ? int(2016, 2025)
          : used
            ? int(2000, 2025)
            : int(2024, 2026)
      mileage = used ? roundTo((2026 - year + 1) * int(8000, 22000), 1000) : 0
      fuel =
        type === "truck"
          ? "diesel"
          : type === "car"
            ? faker.helpers.weightedArrayElement([
                { weight: 70, value: "petrol" },
                { weight: 20, value: "diesel" },
                { weight: 8, value: "hybrid" },
                { weight: 2, value: "electric" },
              ])
            : type === "tuk_tuk" || type === "rickshaw"
              ? pick(["petrol", "petrol", "lpg"])
              : "petrol"
      gear = type === "car" && chance(0.6) ? "automatic" : "manual"
      // A model with no engine size is electric.
      if (model.size === 0) fuel = "electric"
      const frac = Math.min(1, Math.max(0, (year - 2000) / 26))
      const step = type === "car" || type === "truck" ? 100_000 : 50_000
      price = roundTo(
        Math.min(
          model.max,
          Math.max(
            model.min,
            model.min +
              (model.max - model.min) *
                frac *
                (0.75 + faker.number.float() * 0.4)
          )
        ) * 1_000_000,
        step
      )
    } else {
      const cat = pick(partCatalog)
      const item = pick(cat.items)
      partCategoryId = cat.id
      partMake = pick(catalog.filter((m) => m.type === "car"))
      price = roundTo(int(item[2], item[3]), 5000)
      title =
        lang === "en"
          ? `${item[1]} for ${partMake.en}`
          : `${item[0]} لـ ${partMake.ar}`
      // The same index picks both languages' sentences, so they say the same thing. The draws match the old per-language picks, which keeps the seeded data stable.
      const open = lang === "ar" ? int(0, descPartOpen.length - 1) : 0
      const close = int(0, descClose.length - 1)
      desc = {
        ar: `${fill(descPartOpen[open] ?? "", { part: item[0] })} ${descClose[close]}`,
        en: `${fill(descPartOpenEn[open] ?? "", { part: item[1] })} ${descCloseEn[close]}`,
      }
    }
    const rentPeriod =
      intent === "rent" ? pick(["day", "day", "week", "month"] as const) : null
    if (intent === "rent" && model) {
      const day = roundTo((model.min * 1_000_000) / 200, 5000)
      price =
        rentPeriod === "day" ? day : rentPeriod === "week" ? day * 6 : day * 22
    }
    if (model && year) {
      const makeNames = taxonomy.makes.find((m) => m.id === model.makeId)?.name
      const v = {
        make: makeNames?.[lang] ?? "",
        model: lang === "en" ? model.en : model.ar,
        year,
      }
      title =
        lang === "en"
          ? `${fill("{make} {model} {year}", v)} - ${trait[1]}`
          : `${intent === "rent" ? "إيجار " : ""}${fill("{make} {model} {year}", v)} ${trait[0]}`
      const rent = intent === "rent"
      const open = int(0, (rent ? descRentOpen : descOpen).length - 1)
      const close = int(0, descClose.length - 1)
      desc = {
        ar: `${fill((rent ? descRentOpen : descOpen)[open] ?? "", { ...v, make: makeNames?.ar ?? "", model: model.ar })} ${mileage ? `قطعت ${mileage} كم فقط.` : ""} ${descClose[close]}`,
        en: `${fill((rent ? descRentOpenEn : descOpenEn)[open] ?? "", { ...v, make: makeNames?.en ?? "", model: model.en })} ${mileage ? `Only ${mileage} km driven.` : ""} ${descCloseEn[close]}`,
      }
    }

    const approved = moderation === "approved"
    const created =
      moderation === "pending"
        ? int(2 * HOUR, 3 * DAY)
        : omar && ownerUser?.id === omar.id && n % 11 === 0
          ? 24.5 * DAY
          : int(2 * HOUR, 26 * DAY)
    const sold = approved && chance(0.08)
    const status: ListingStatus = sold
      ? intent === "rent"
        ? "rented"
        : "sold"
      : approved && chance(0.04)
        ? "reserved"
        : "available"
    const mediaCount = moderation === "draft" ? int(0, 2) : int(2, 6)
    const photoType = type ?? "part"
    const media: Media[] = Array.from({ length: mediaCount }, (_, k) => {
      const p = pickMockPhoto(photoType, n * 7 + k)
      return { ...p, id: `${id}-m${k}` }
    })
    if (chance(0.12) && mediaCount > 0) {
      media.push({
        id: `${id}-v`,
        type: "video",
        url: `/mock/video-0${(n % 3) + 1}.mp4`,
        width: 1280,
        height: 720,
        placeholderColor: "#b8c4c0",
        posterUrl: `/mock/video-0${(n % 3) + 1}-{w}.webp`,
      })
    }
    const ownerPhone = dealer
      ? (dealer.phones[0] ?? "+249912345602")
      : (person?.phone ?? "+249912345601")
    const hasWhatsapp = dealer
      ? dealer.whatsapp
      : chance(0.6)
        ? ownerPhone
        : null
    const makeId = model?.makeId ?? partMake?.makeId ?? null
    const makeName = taxonomy.makes.find((m) => m.id === makeId)
    const row: ListingRow = {
      id,
      slug: makeListingSlug(title, cityRow?.id ?? "", id),
      kind,
      intent,
      vehicleType: type,
      title,
      description: {
        ar: desc.ar.replace(/\s+/g, " ").trim(),
        en: desc.en.replace(/\s+/g, " ").trim(),
      },
      price,
      negotiable: chance(0.7),
      rentPeriod,
      condition: used ? "used" : "new",
      makeId,
      modelId: model?.id ?? null,
      makeOther: null,
      modelOther: null,
      year,
      mileageKm: mileage,
      fuel,
      transmission: gear,
      color: model ? pick(colors) : null,
      engineCc:
        model && model.type !== "truck" && model.size ? model.size : null,
      payloadTons: model?.type === "truck" ? model.size : null,
      partCategoryId,
      compatibleTypes: kind === "part" ? ["car"] : [],
      ...seedSpecs({
        n,
        kind,
        type,
        intent,
        used,
        year,
        cityId: city,
        makeId,
        engineCc:
          model && model.type !== "truck" && model.size ? model.size : null,
      }),
      media,
      cityId: city,
      districtId: district.id,
      location:
        cityRow && chance(0.9)
          ? { lat: jitter(cityRow.center.lat), lng: jitter(cityRow.center.lng) }
          : null,
      status,
      moderation,
      rejectionReason:
        moderation === "rejected"
          ? pick([
              "Photos are unclear / الصور غير واضحة",
              "Price is unrealistic / السعر غير منطقي",
              "Description is incomplete / الوصف غير مكتمل",
            ])
          : null,
      promotions: [],
      owner: dealer
        ? {
            id: dealer.ownerId,
            type: "dealership",
            name: dealer.name,
            avatarUrl: dealer.logoUrl,
            verified: dealer.verified,
            memberSince: dealer.createdAt,
            profileSlug: dealer.slug,
          }
        : {
            id: person?.id ?? "u-omar",
            type: "user",
            name: bilingualName(person?.fullName ?? ""),
            avatarUrl: null,
            verified: Boolean(person?.verifiedPhone),
            memberSince: person?.createdAt ?? ago(DAY),
            profileSlug: null,
          },
      ownerUserId: ownerUser?.id ?? "u-omar",
      contact: {
        phone: ownerPhone,
        whatsapp: hasWhatsapp,
        showPhone: chance(0.9),
        methods: [
          "call",
          ...(hasWhatsapp ? (["whatsapp"] as const) : []),
          ...(chance(0.8) ? (["chat"] as const) : []),
        ],
      },
      stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
      createdAt: ago(created),
      updatedAt: ago(Math.max(0, created - int(0, 2 * DAY))),
      expiresAt: ahead(30 * DAY - created),
    }
    if (makeName && !row.description.ar) row.description = makeName.name
    if (approved) {
      const age = Math.max(1, created / DAY)
      row.stats = {
        views: Math.round(int(20, 60) * age),
        favorites: int(0, 40),
        phoneClicks: int(0, 25),
        whatsappClicks: int(0, 25),
      }
      if (status === "available" && chance(0.15)) {
        const days = pick(featuredDays)
        const startMs = int(HOUR, (days / 2) * DAY)
        const startsAt = ago(startMs)
        const endsAt = ahead(days * DAY - startMs)
        row.promotions.push({ type: "featured", startsAt, endsAt })
        row.stats.views *= 2
        promotions.push({
          id: `promo-${promotions.length + 1}`,
          listingId: id,
          type: "featured",
          status: "active",
          durationDays: days,
          startsAt,
          endsAt,
          source: "paid",
        })
      }
    }
    listings.push(row)
  }

  for (const p of plans) {
    for (let i = 0; i < p.n; i++)
      make({
        kind: p.kind,
        intent: p.intent,
        type: p.types.length ? pick(p.types) : null,
        moderation: "approved",
      })
  }
  // Twenty listings in other states belong to the demo accounts so their dashboards have content.
  const others: Moderation[] = [
    ...Array<Moderation>(8).fill("pending"),
    ...Array<Moderation>(6).fill("rejected"),
    ...Array<Moderation>(6).fill("draft"),
  ]
  others.forEach((moderation, i) =>
    make({
      kind: "vehicle",
      intent: "sale",
      type: i % 4 === 0 ? "truck" : "car",
      moderation,
      demoOnly: true,
    })
  )
  // A few finished promotions so the history tables have rows.
  for (const row of listings
    .filter((l) => l.moderation === "approved")
    .slice(0, 5)) {
    promotions.push({
      id: `promo-${promotions.length + 1}`,
      listingId: row.id,
      type: "featured",
      status: "ended",
      durationDays: 3,
      startsAt: ago(20 * DAY),
      endsAt: ago(17 * DAY),
      source: "paid",
    })
  }
  // Two promotions waiting for payment on listings of the demo seller and the demo dealership, for the checkout and the admin queue.
  const waiting: [string, PromotionType, number][] = [
    ["u-omar", "bump", 0],
    ["u-dealer", "featured", 7],
  ]
  for (const [ownerId, type, durationDays] of waiting) {
    const mine = listings.find(
      (l) =>
        l.ownerUserId === ownerId &&
        l.moderation === "approved" &&
        l.promotions.length === 0
    )
    if (mine)
      promotions.push({
        id: `promo-${promotions.length + 1}`,
        listingId: mine.id,
        type,
        status: "pending_payment",
        durationDays,
        source: "paid",
      })
  }
  return { listings, promotions }
}
