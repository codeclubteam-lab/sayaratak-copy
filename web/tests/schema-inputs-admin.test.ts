import { expect, it } from "vitest"

import {
  bannerCopySchema,
  bulkResultSchema,
} from "@sayaratak/shared/schemas/admin"
import { resetTokenSchema, uploadSchema } from "@sayaratak/shared/schemas/api"
import {
  adPagePatchSchema,
  adminListingPatchSchema,
  assignPlanInputSchema,
  banInputSchema,
  bannerInputSchema,
  broadcastEstimateQuerySchema,
  broadcastInputSchema,
  bulkInputSchema,
  businessAdminPatchSchema,
  businessPatchSchema,
  campaignInputSchema,
  grantInputSchema,
  idsInputSchema,
  imagesInputSchema,
  noteInputSchema,
  pagePatchSchema,
  pathSchema,
  planInputSchema,
  portfolioInputSchema,
  rejectInputSchema,
  reportActionInputSchema,
  serviceInputSchema,
  settingsPatchSchema,
  taxonomyInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { runCases } from "./schema-case"

const bi = (s: string) => ({ ar: s, en: s })
const plan = {
  audience: "dealership",
  name: bi("Pro"),
  price: 50_000,
  durationDays: 30,
  listingLimit: 50,
  serviceLimit: null,
  photoLimit: null,
  portfolioLimit: null,
  featuredCredits: 2,
  features: [bi("Top of search")],
  enabled: true,
  sortOrder: 1,
}
const broadcast = {
  roles: ["user"],
  verifiedOnly: false,
  title: bi("Update"),
  body: bi("Text"),
}
const copy = { eyebrow: "", heading: "Sale", body: "", cta: "Shop" }
const banner = {
  title: "Eid",
  imageUrl: bi("/b.webp"),
  href: "/ar/search",
  placement: "home_top",
  startsAt: "2026-10-01",
  endsAt: "2026-10-30",
}
const text = { heading: "Sale", body: "", cta: "Shop" }
const campaign = {
  creative: { imageUrl: "/a.webp", copy: { ar: text, en: text } },
  href: "/ar",
  pages: ["home_top"],
  startDate: "2026-11-01",
  weeks: 2,
}

// Request bodies for business self-service, admin tools and banner campaigns, plus small response objects.
runCases([
  {
    name: "businessPatchSchema",
    schema: businessPatchSchema,
    valid: [{ name: "X" }],
    bad: [["not an object", "x"]],
  },
  {
    name: "serviceInputSchema",
    schema: serviceInputSchema,
    valid: [
      { name: "Oil change", priceFrom: null },
      {
        name: "Oil change",
        description: "",
        priceFrom: 5000,
        templateId: "t1",
      },
    ],
    bad: [
      ["no name", { name: "", priceFrom: null }, "validation.required"],
      [
        "long description",
        { name: "Oil", description: "a".repeat(301), priceFrom: null },
        "validation.too_long",
      ],
      ["zero price", { name: "Oil", priceFrom: 0 }, "validation.price_min"],
    ],
  },
  {
    name: "portfolioInputSchema",
    schema: portfolioInputSchema,
    valid: [{ imageId: "up-1", caption: "Engine rebuild" }],
    bad: [
      ["no image", { imageId: "", caption: "A" }, "validation.required"],
      [
        "long caption",
        { imageId: "up-1", caption: "a".repeat(121) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "idsInputSchema",
    schema: idsInputSchema,
    valid: [{ ids: [] }],
    bad: [["not a list", { ids: "a" }]],
  },
  {
    name: "imagesInputSchema",
    schema: imagesInputSchema,
    valid: [{ url: "/a.webp" }],
    bad: [["empty", { url: "" }, "validation.required"]],
  },
  {
    name: "rejectInputSchema",
    schema: rejectInputSchema,
    valid: [{ reason: "Blurry photos" }],
    bad: [
      ["blank", { reason: " " }, "validation.required"],
      ["long", { reason: "a".repeat(301) }, "validation.too_long"],
    ],
  },
  {
    name: "noteInputSchema",
    schema: noteInputSchema,
    valid: [{}, { note: "ok" }],
    bad: [["long", { note: "a".repeat(301) }]],
  },
  {
    name: "bulkInputSchema",
    schema: bulkInputSchema,
    valid: [{ ids: ["k1"], action: "approve" }],
    bad: [
      ["no ids", { ids: [], action: "approve" }],
      ["unknown action", { ids: ["k1"], action: "hide" }],
    ],
  },
  {
    name: "banInputSchema",
    schema: banInputSchema,
    valid: [{ reason: "Scam", duration: "7d" }],
    bad: [
      ["no reason", { reason: "", duration: "7d" }, "validation.required"],
      ["unknown duration", { reason: "Scam", duration: "1d" }],
    ],
  },
  {
    name: "reportActionInputSchema",
    schema: reportActionInputSchema,
    valid: [{}, { note: "x", ban: { reason: "Scam", duration: "permanent" } }],
    bad: [
      [
        "ban without reason",
        { ban: { reason: "", duration: "7d" } },
        "validation.required",
      ],
    ],
  },
  {
    name: "businessAdminPatchSchema",
    schema: businessAdminPatchSchema,
    valid: [{}, { status: "suspended", reason: "Fake" }, { verified: true }],
    bad: [
      ["blank reason", { reason: " " }],
      ["unknown status", { status: "closed" }],
    ],
  },
  {
    name: "assignPlanInputSchema",
    schema: assignPlanInputSchema,
    valid: [
      { planId: "p1" },
      { planId: "p1", price: 0, limit: null, durationDays: 30, note: "" },
    ],
    bad: [
      ["no plan", { planId: "" }],
      ["negative price", { planId: "p1", price: -1 }],
      ["zero days", { planId: "p1", durationDays: 0 }],
      ["long note", { planId: "p1", note: "a".repeat(201) }],
    ],
  },
  {
    name: "planInputSchema",
    schema: planInputSchema,
    valid: [plan],
    bad: [
      ["admin audience", { ...plan, audience: "admin" }],
      ["blank name", { ...plan, name: bi(" ") }],
      ["negative price", { ...plan, price: -1 }],
      ["over two years", { ...plan, durationDays: 731 }],
      ["negative cap", { ...plan, listingLimit: -1 }],
      ["nine features", { ...plan, features: Array(9).fill(bi("x")) }],
      ["sort over 999", { ...plan, sortOrder: 1000 }],
    ],
  },
  {
    name: "grantInputSchema",
    schema: grantInputSchema,
    valid: [{ listingId: "k1", type: "featured" }],
    bad: [["zero days", { listingId: "k1", type: "featured", days: 0 }]],
  },
  {
    name: "pathSchema",
    schema: pathSchema,
    valid: ["/ar/search", " /en "],
    bad: [
      ["full url", "https://x.co", "validation.path"],
      ["protocol relative", "//x.co", "validation.path"],
      ["long", "/" + "a".repeat(200), "validation.too_long"],
    ],
  },
  {
    name: "broadcastInputSchema",
    schema: broadcastInputSchema,
    valid: [broadcast, { ...broadcast, cityId: "khartoum", href: "/ar" }],
    bad: [
      ["no roles", { ...broadcast, roles: [] }, "validation.select_min"],
      ["blank title", { ...broadcast, title: bi("") }, "validation.required"],
      [
        "long body",
        { ...broadcast, body: bi("a".repeat(301)) },
        "validation.too_long",
      ],
      ["outside link", { ...broadcast, href: "//x.co" }, "validation.path"],
    ],
  },
  {
    name: "adminListingPatchSchema",
    schema: adminListingPatchSchema,
    valid: [{}, { status: "sold", moderation: "rejected", price: 1 }],
    bad: [
      ["zero price", { price: 0 }, "validation.price_min"],
      ["blank title", { title: "" }, "validation.required"],
    ],
  },
  {
    name: "taxonomyInputSchema",
    schema: taxonomyInputSchema,
    valid: [{ id: "x" }],
    bad: [["list", []]],
  },
  {
    name: "broadcastEstimateQuerySchema",
    schema: broadcastEstimateQuerySchema,
    valid: [
      { roles: ["user"] },
      { roles: ["dealership", "mechanic"], cityId: "", verifiedOnly: true },
    ],
    bad: [
      ["no role", { roles: [] }, "validation.select_min"],
      ["an admin audience", { roles: ["admin"] }],
    ],
  },
  {
    name: "bannerInputSchema",
    schema: bannerInputSchema,
    valid: [
      banner,
      { ...banner, copy: { ar: copy, en: copy }, focus: 0, sponsored: true },
    ],
    bad: [
      ["no title", { ...banner, title: "" }, "validation.required"],
      ["no link", { ...banner, href: "" }, "validation.path"],
      ["unknown placement", { ...banner, placement: "footer" }],
      ["focus over 100", { ...banner, focus: 101 }],
    ],
  },
  {
    name: "pagePatchSchema",
    schema: pagePatchSchema,
    valid: [{}, { title: bi("About") }],
    bad: [["missing en", { body: { ar: "x" } }]],
  },
  {
    name: "settingsPatchSchema",
    schema: settingsPatchSchema,
    valid: [{}, { listingExpiryDays: 30 }, { freeListingLimit: 0 }],
    bad: [
      ["not an object", 1],
      ["no expiry days", { listingExpiryDays: 0 }, "validation.number"],
      ["negative limit", { freeListingLimit: -1 }, "validation.number"],
      ["bank account without a number", { bankakAccount: { name: "x" } }],
    ],
  },
  {
    name: "campaignInputSchema",
    schema: campaignInputSchema,
    valid: [campaign],
    bad: [
      [
        "no image",
        { ...campaign, creative: { ...campaign.creative, imageUrl: "" } },
        "validation.required",
      ],
      [
        "short heading",
        {
          ...campaign,
          creative: {
            ...campaign.creative,
            copy: { ar: { ...text, heading: "a" }, en: text },
          },
        },
        "validation.required",
      ],
      [
        "long cta",
        {
          ...campaign,
          creative: {
            ...campaign.creative,
            copy: { ar: text, en: { ...text, cta: "a".repeat(25) } },
          },
        },
        "validation.too_long",
      ],
      ["no link", { ...campaign, href: "" }, "validation.required"],
      ["no pages", { ...campaign, pages: [] }, "validation.ad_pages"],
      [
        "bad date",
        { ...campaign, startDate: "1/11/2026" },
        "validation.required",
      ],
      ["five weeks", { ...campaign, weeks: 5 }],
    ],
  },
  {
    name: "adPagePatchSchema",
    schema: adPagePatchSchema,
    valid: [{}, { weeklyPrice: 0, slots: 10, enabled: false }],
    bad: [
      ["negative price", { weeklyPrice: -1 }],
      ["eleven slots", { slots: 11 }],
    ],
  },
  {
    name: "bulkResultSchema",
    schema: bulkResultSchema,
    valid: [{ count: 2 }],
    bad: [["decimal", { count: 1.5 }]],
  },
  {
    name: "uploadSchema",
    schema: uploadSchema,
    valid: [
      {
        id: "up-1",
        url: "/api/uploads/up-1",
        type: "image",
        name: "a.webp",
        size: 10,
      },
    ],
    bad: [
      [
        "unknown type",
        { id: "up-1", url: "/u", type: "doc", name: "a", size: 1 },
      ],
    ],
  },
  {
    name: "resetTokenSchema",
    schema: resetTokenSchema,
    valid: [{ token: "t" }],
    bad: [["no token", {}]],
  },
  {
    name: "bannerCopySchema",
    schema: bannerCopySchema,
    valid: [copy],
    bad: [["no cta", { eyebrow: "", heading: "", body: "" }]],
  },
])

it("grantInputSchema gives a week by default", () => {
  expect(
    grantInputSchema.parse({ listingId: "k1", type: "featured" }).days
  ).toBe(7)
})
it("bannerInputSchema fills its defaults", () => {
  expect(bannerInputSchema.parse(banner)).toMatchObject({
    sponsored: false,
    focus: 50,
    active: true,
    sortOrder: 0,
  })
})
