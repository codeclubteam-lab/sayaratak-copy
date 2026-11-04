import { describe, expect, it } from "vitest"

import {
  bannerFormDefaults,
  bannerFormSchema,
  bannerState,
  fromBanner,
  mediaOf,
  toBannerInput,
} from "@/features/admin-banners/schemas"
import { campaignFormSchema, stepFields } from "@/features/ads/schemas"
import {
  emailFormSchema,
  loginFormSchema,
  newPasswordFormSchema,
  otpFormSchema,
  signupFormSchema,
} from "@/features/auth/schemas"
import { newPasswordFormSchema as socialPasswordFormSchema } from "@/features/settings/schemas"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { runCases } from "./schema-case"

const password = "abcd1234"
const signup = {
  fullName: "Omar Hassan",
  email: "a@b.co",
  password,
  confirmPassword: password,
  terms: true,
}
const copy = {
  eyebrow: "",
  heading: "Eid sale",
  body: "Every car checked.",
  cta: "Shop",
}
const banner = {
  ...bannerFormDefaults(),
  title: "Eid",
  imageAr: "/b.webp",
  href: "/ar/search",
  copy: { ar: copy, en: copy },
}
const text = { heading: "Sale", body: "", cta: "Shop" }
const campaign = {
  cover: mediaOf("/a.webp"),
  copy: { ar: text, en: text },
  href: "/ar",
  startDate: "2026-11-01",
  weeks: 1,
  pages: ["home_top"],
}

runCases([
  {
    name: "loginFormSchema",
    schema: loginFormSchema,
    valid: [{ email: "a@b.co", password: "x" }],
    bad: [
      ["no password", { email: "a@b.co", password: "" }, "validation.required"],
    ],
  },
  {
    name: "signupFormSchema",
    schema: signupFormSchema,
    valid: [signup],
    bad: [
      ["short name", { ...signup, fullName: "O" }, "validation.name_min"],
      ["bad email", { ...signup, email: "a" }, "validation.email"],
      [
        "weak password",
        { ...signup, password: "abc", confirmPassword: "abc" },
        "validation.password_min",
      ],
      ["no confirm", { ...signup, confirmPassword: "" }, "validation.required"],
      [
        "mismatch",
        { ...signup, confirmPassword: "abcd12345" },
        "validation.password_match",
      ],
      ["terms off", { ...signup, terms: false }, "validation.terms"],
    ],
  },
  {
    name: "emailFormSchema",
    schema: emailFormSchema,
    valid: [{ email: "a@b.co" }],
    bad: [["bad", { email: "a" }, "validation.email"]],
  },
  {
    name: "newPasswordFormSchema",
    schema: newPasswordFormSchema,
    valid: [{ password, confirmPassword: password }],
    bad: [
      [
        "mismatch",
        { password, confirmPassword: "x" },
        "validation.password_match",
      ],
      [
        "no digit",
        { password: "abcdefgh", confirmPassword: "abcdefgh" },
        "validation.password_digit",
      ],
    ],
  },
  {
    name: "otpFormSchema",
    schema: otpFormSchema,
    valid: [{ code: "123456" }],
    bad: [["letters", { code: "12345a" }, "validation.otp"]],
  },
  {
    name: "settings newPasswordFormSchema",
    schema: socialPasswordFormSchema,
    valid: [{ currentPassword: "", newPassword: password }],
    bad: [
      [
        "weak",
        { currentPassword: "", newPassword: "abc" },
        "validation.password_min",
      ],
    ],
  },
  {
    name: "bannerFormSchema",
    schema: bannerFormSchema,
    valid: [banner, { ...banner, href: "https://x.co" }],
    bad: [
      ["no title", { ...banner, title: "" }, "validation.required"],
      ["no Arabic photo", { ...banner, imageAr: "" }, "validation.required"],
      ["bad link", { ...banner, href: "x.co" }, "validation.url"],
      ["no start", { ...banner, startsAt: undefined }, "validation.required"],
      [
        "ends first",
        { ...banner, endsAt: new Date(2000, 0, 1) },
        "validation.date_order",
      ],
      [
        "long eyebrow",
        {
          ...banner,
          copy: { ar: { ...copy, eyebrow: "a".repeat(31) }, en: copy },
        },
        "validation.too_long",
      ],
      [
        "no heading",
        { ...banner, copy: { ar: copy, en: { ...copy, heading: "" } } },
        "validation.required",
      ],
      ["focus over 100", { ...banner, focus: 101 }],
    ],
  },
  {
    name: "campaignFormSchema",
    schema: campaignFormSchema,
    valid: [campaign],
    bad: [
      ["no photo", { ...campaign, cover: null }, "validation.ad_photo"],
      ["no target", { ...campaign, href: "" }, "validation.ad_target"],
      ["no pages", { ...campaign, pages: [] }, "validation.ad_pages"],
      ["bad date", { ...campaign, startDate: "soon" }, "validation.required"],
      ["no weeks", { ...campaign, weeks: 0 }],
    ],
  },
])

describe("banner form helpers", () => {
  const stored = bannerSchema.parse({
    id: "b1",
    title: "Eid",
    imageUrl: { ar: "/b.webp", en: "/b.webp" },
    href: "/ar",
    placement: "home_top",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-31T00:00:00.000Z",
    active: true,
    sortOrder: 0,
    impressions: 0,
    clicks: 0,
  })
  it("defaults run 30 days from today", () => {
    const d = bannerFormDefaults()
    expect(d.endsAt!.getTime() - d.startsAt!.getTime()).toBe(30 * 86_400_000)
  })
  it("toBannerInput covers whole days and reuses the Arabic photo", () => {
    const input = toBannerInput(bannerFormSchema.parse(banner))
    expect(bannerInputSchema.safeParse(input).success).toBe(true)
    expect(input.imageUrl).toEqual({ ar: "/b.webp", en: "/b.webp" })
    expect(new Date(input.endsAt).getHours()).toBe(23)
  })
  it("fromBanner leaves the English photo empty when it is the Arabic one, and fills empty text for an image banner", () => {
    const form = fromBanner(stored)
    expect(form.imageEn).toBe("")
    expect(form.copy?.ar.heading).toBe("")
  })
  it("mediaOf makes an uploader value", () => {
    expect(mediaSchema.safeParse(mediaOf("/b.webp")).success).toBe(true)
  })
  it("bannerState reads off, scheduled, live and ended", () => {
    const at = (iso: string) => Date.parse(iso)
    expect(bannerState({ ...stored, active: false }, at("2026-10-10"))).toBe(
      "off"
    )
    expect(bannerState(stored, at("2026-09-01"))).toBe("scheduled")
    expect(bannerState(stored, at("2026-10-10"))).toBe("live")
    expect(bannerState(stored, at("2026-11-10"))).toBe("ended")
  })
})

it("every campaign field belongs to one wizard step", () => {
  expect(stepFields.flat().sort()).toEqual(
    Object.keys(campaignFormSchema.shape).sort()
  )
})
