import { describe, expect, it } from "vitest"

import {
  adminListingsSearchSchema,
  adminTableSearchSchema,
  assignPlanSchema,
  banDurations,
  banSchema,
  businessesSearchSchema,
  grantSchema,
  locationsSearchSchema,
  makesSearchSchema,
  moderationSearchSchema,
  paymentsSearchSchema,
  plansSearchSchema,
  reasonSchema,
  reportsSearchSchema,
  reviewsSearchSchema,
  usersSearchSchema,
  verificationsSearchSchema,
} from "@/features/admin/schemas"
import {
  fromPage,
  pageFormSchema,
  pageSlugs,
  pagesSearchSchema,
  toPagePatch,
} from "@/features/admin-pages/schemas"
import { sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { pagePatchSchema } from "@sayaratak/shared/schemas/inputs"
import { runCases } from "./schema-case"

const long = "a".repeat(61)
const body = "A page body that is long enough."
const page = { titleAr: "عن", titleEn: "About", bodyAr: body, bodyEn: body }

runCases([
  {
    name: "reasonSchema",
    schema: reasonSchema,
    valid: [{ reason: "Spam" }],
    bad: [
      ["blank", { reason: " " }, "validation.required"],
      ["long", { reason: "a".repeat(301) }, "validation.too_long"],
    ],
  },
  {
    name: "banSchema",
    schema: banSchema,
    valid: banDurations.map((duration) => ({ reason: "Spam", duration })),
    bad: [["no reason", { reason: "", duration: "7d" }, "validation.required"]],
  },
  {
    name: "grantSchema",
    schema: grantSchema,
    valid: [{ type: "featured", days: 365 }],
    bad: [
      ["no days", { type: "featured", days: null }, "validation.required"],
      ["over a year", { type: "featured", days: 366 }, "validation.too_large"],
      ["unknown type", { type: "gold", days: 7 }],
    ],
  },
  {
    name: "assignPlanSchema",
    schema: assignPlanSchema,
    valid: [
      {
        planId: "p1",
        customPrice: null,
        customLimit: null,
        durationDays: null,
        note: "",
      },
    ],
    bad: [
      [
        "no plan",
        {
          planId: "",
          customPrice: null,
          customLimit: null,
          durationDays: null,
        },
        "validation.required",
      ],
      [
        "zero days",
        { planId: "p1", customPrice: null, customLimit: null, durationDays: 0 },
        "validation.number",
      ],
      [
        "long note",
        {
          planId: "p1",
          customPrice: null,
          customLimit: null,
          durationDays: null,
          note: "a".repeat(201),
        },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "pageFormSchema",
    schema: pageFormSchema,
    valid: [page],
    bad: [
      ["no title", { ...page, titleEn: "" }, "validation.required"],
      ["short body", { ...page, bodyAr: "short" }, "validation.desc_min"],
      [
        "long body",
        { ...page, bodyEn: "a".repeat(10001) },
        "validation.too_long",
      ],
    ],
  },
])

// URL schemas never throw: a bad value falls back or drops, so a hand-edited address still opens the page.
describe("admin URL schemas", () => {
  const tabbed = [
    ["adminListingsSearchSchema", adminListingsSearchSchema, "all"],
    ["reportsSearchSchema", reportsSearchSchema, "open"],
    ["reviewsSearchSchema", reviewsSearchSchema, "flagged"],
    ["verificationsSearchSchema", verificationsSearchSchema, "pending"],
    ["paymentsSearchSchema", paymentsSearchSchema, "pending"],
    ["plansSearchSchema", plansSearchSchema, "user"],
    ["locationsSearchSchema", locationsSearchSchema, "countries"],
  ] as const
  it.each(tabbed)(
    "%s starts on its first tab and falls back to it",
    (_, schema, first) => {
      expect(schema.parse({})).toMatchObject({ tab: first, page: 1 })
      expect(schema.parse({ tab: "nope" }).tab).toBe(first)
    }
  )
  it("adminTableSearchSchema reads the page and drops bad values", () => {
    expect(adminTableSearchSchema.parse({ page: "3", q: " to " })).toEqual({
      page: 3,
      q: "to",
    })
    expect(
      adminTableSearchSchema.parse({ page: "0", q: long, id: long })
    ).toEqual({ page: 1 })
  })
  it("listing filters keep known values only", () => {
    expect(
      adminListingsSearchSchema.parse({
        type: "truck",
        sellerKind: "verified",
        promoted: "yes",
      })
    ).toMatchObject({ type: "truck", sellerKind: "verified", promoted: "yes" })
    expect(
      adminListingsSearchSchema.parse({
        type: "boat",
        sellerKind: "x",
        promoted: "maybe",
      })
    ).toMatchObject({ type: undefined, sellerKind: "all", promoted: undefined })
  })
  it("user, business, review and plan filters drop unknown values", () => {
    expect(
      usersSearchSchema.parse({ role: "admin", status: "banned" })
    ).toMatchObject({ role: "admin", status: "banned" })
    expect(
      usersSearchSchema.parse({ role: "guest", status: "x" })
    ).toMatchObject({ role: undefined, status: undefined })
    expect(
      businessesSearchSchema.parse({ verified: "no", status: "closed" })
    ).toMatchObject({ verified: "no", status: undefined })
    expect(
      reviewsSearchSchema.parse({ rating: "4", targetType: "mechanic" })
    ).toMatchObject({ rating: 4, targetType: "mechanic" })
    expect(reviewsSearchSchema.parse({ rating: "6" }).rating).toBeUndefined()
    expect(
      plansSearchSchema.parse({ status: "canceled", audience: "admin" })
    ).toMatchObject({ status: "canceled", audience: undefined })
  })
  it("makes and moderation keep the open row", () => {
    expect(makesSearchSchema.parse({ make: "toyota", q: long })).toEqual({
      make: "toyota",
      q: undefined,
    })
    expect(
      moderationSearchSchema.parse({ listing: "k1", type: "part" })
    ).toEqual({ listing: "k1", type: "part", sellerKind: "all" })
    expect(moderationSearchSchema.parse({ type: "boat" }).type).toBeUndefined()
  })
  it("pagesSearchSchema opens About for an unknown page", () => {
    expect(pagesSearchSchema.parse({})).toEqual({ page: "about" })
    expect(pagesSearchSchema.parse({ page: "nope" })).toEqual({ page: "about" })
    expect(pagesSearchSchema.parse({ page: pageSlugs[1] })).toEqual({
      page: pageSlugs[1],
    })
  })
})

it("fromPage and toPagePatch round-trip a page", () => {
  const patch = toPagePatch(page)
  expect(pagePatchSchema.safeParse(patch).success).toBe(true)
  const back = fromPage(
    sitePageSchema.parse({
      slug: "about",
      updatedAt: "2026-10-01T00:00:00.000Z",
      ...patch,
    })
  )
  expect(back).toEqual(page)
})
